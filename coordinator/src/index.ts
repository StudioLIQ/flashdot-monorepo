import http from "node:http";

import { count, notInArray } from "drizzle-orm";
import { Contract, JsonRpcProvider, Wallet } from "ethers";

import { config } from "./config.js";
import { closeDb, db, runMigrations } from "./db/index.js";
import { loans } from "./db/schema.js";
import { LoanState } from "./lifecycle/constants.js";
import { startLoanWatcher } from "./loan-watcher.js";
import type { HubContractLike } from "./lifecycle/shared.js";
import { processRetryQueue, type HubRetryContract } from "./retry-engine.js";
import { runTimeoutEnforcer, type HubTimeoutContract } from "./timeout-enforcer.js";

const RETRY_LOOP_MS = 5_000;
const TERMINAL_LOAN_STATES: number[] = [
  LoanState.Settled,
  LoanState.Defaulted,
  LoanState.Aborted,
];

const HUB_ABI = [
  "event LoanCreated(uint256 indexed loanId, address borrower, address asset, uint256 targetAmount, uint256 bondAmount)",
  "event PreparedAcked(uint256 indexed loanId, uint256 legId, bytes32 chain)",
  "event CommittedAcked(uint256 indexed loanId, uint256 legId, bytes32 chain)",
  "event RepayConfirmed(uint256 indexed loanId, uint256 legId, uint256 amount)",
  "function getLoan(uint256 loanId) view returns (tuple(address borrower,address asset,uint256 targetAmount,uint32 interestBps,uint64 createdAt,uint64 expiryAt,uint8 state,bool repayOnlyMode,bytes32 planHash))",
  "function getBondInfo(uint256 loanId) view returns (tuple(uint256 bondAmount,uint64 lockedAt,bool slashed))",
  "function getLeg(uint256 loanId,uint256 legId) view returns (tuple(bytes32 chain,address vault,uint256 amount,uint256 feeBudget,uint32 legInterestBps,uint8 state))",
  "function getLegCount(uint256 loanId) view returns (uint256)",
  "function cancelBeforeCommit(uint256 loanId)",
  "function enforceCommitTimeout(uint256 loanId)",
  "function startPrepare(uint256 loanId)",
  "function startCommit(uint256 loanId)",
  "function finalizeSettle(uint256 loanId)",
  "function triggerDefault(uint256 loanId)",
] as const;

async function activeLoanCount(): Promise<number> {
  const rows = await db
    .select({ value: count() })
    .from(loans)
    .where(notInArray(loans.state, TERMINAL_LOAN_STATES));

  return Number(rows[0]?.value ?? 0);
}

async function recoverActiveLoans(): Promise<Array<{ loanId: string; state: number }>> {
  const rows = await db
    .select({ loanId: loans.loanId, state: loans.state })
    .from(loans)
    .where(notInArray(loans.state, TERMINAL_LOAN_STATES));

  return rows;
}

async function main(): Promise<void> {
  runMigrations();

  const provider = new JsonRpcProvider(config.hub.rpcUrl);
  const signer = new Wallet(config.coordinator.privateKey, provider);
  const hubContract = new Contract(config.hub.address, HUB_ABI, signer) as unknown as
    HubContractLike & HubRetryContract & HubTimeoutContract;

  const restoredLoans = await recoverActiveLoans();
  if (restoredLoans.length > 0) {
    console.log(`[coordinator] restored ${restoredLoans.length} active loans from DB`);
  }

  const watcher = await startLoanWatcher(hubContract);

  await processRetryQueue(hubContract);
  await runTimeoutEnforcer(hubContract);

  const retryTimer = setInterval(() => {
    void processRetryQueue(hubContract).catch((error) => {
      console.error("[coordinator] retry loop error:", error);
    });
  }, RETRY_LOOP_MS);

  const timeoutTimer = setInterval(() => {
    void runTimeoutEnforcer(hubContract).catch((error) => {
      console.error("[coordinator] timeout enforcer error:", error);
    });
  }, config.timeouts.defaultCheckMs);

  const server = http.createServer((req, res) => {
    if (req.method !== "GET" || req.url !== "/health") {
      res.statusCode = 404;
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ error: "not_found" }));
      return;
    }

    void (async () => {
      try {
        const [blockNumber, loanCount] = await Promise.all([
          provider.getBlockNumber(),
          activeLoanCount(),
        ]);

        res.statusCode = 200;
        res.setHeader("content-type", "application/json");
        res.end(
          JSON.stringify({
            status: "ok",
            blockNumber,
            activeLoanCount: loanCount,
          })
        );
      } catch (error) {
        res.statusCode = 500;
        res.setHeader("content-type", "application/json");
        res.end(
          JSON.stringify({
            status: "error",
            error: error instanceof Error ? error.message : String(error),
          })
        );
      }
    })();
  });

  await new Promise<void>((resolve) => {
    server.listen(config.coordinator.port, () => {
      console.log(`[coordinator] listening on :${config.coordinator.port}`);
      resolve();
    });
  });

  let shuttingDown = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;

    console.log(`[coordinator] ${signal} received, shutting down...`);
    clearInterval(retryTimer);
    clearInterval(timeoutTimer);

    await watcher.stop();
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    closeDb();

    console.log("[coordinator] shutdown complete");
  };

  process.on("SIGINT", () => {
    void shutdown("SIGINT");
  });
  process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
}

void main().catch((error) => {
  console.error("[coordinator] fatal error:", error);
  process.exit(1);
});
