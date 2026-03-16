import http from "node:http";

import { count, isNotNull, notInArray } from "drizzle-orm";
import { Contract, JsonRpcProvider, Wallet } from "ethers";

import { config } from "./config.js";
import { closeDb, db, runMigrations } from "./db/index.js";
import { loans, retryQueue, xcmEvents } from "./db/schema.js";
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
const coordinatorMetrics = {
  errorsTotal: 0,
};

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

async function retryQueueSize(): Promise<number> {
  const rows = await db.select({ value: count() }).from(retryQueue);
  return Number(rows[0]?.value ?? 0);
}

async function averageAckLatencyMs(): Promise<number> {
  const rows = await db
    .select({
      sentAt: xcmEvents.sentAt,
      ackedAt: xcmEvents.ackedAt,
    })
    .from(xcmEvents)
    .where(isNotNull(xcmEvents.ackedAt));

  if (rows.length === 0) {
    return 0;
  }

  const totalLatency = rows.reduce((sum, row) => sum + ((row.ackedAt ?? row.sentAt) - row.sentAt), 0);
  return Math.round(totalLatency / rows.length);
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
      coordinatorMetrics.errorsTotal += 1;
      console.error("[coordinator] retry loop error:", error);
    });
  }, RETRY_LOOP_MS);

  const timeoutTimer = setInterval(() => {
    void runTimeoutEnforcer(hubContract).catch((error) => {
      coordinatorMetrics.errorsTotal += 1;
      console.error("[coordinator] timeout enforcer error:", error);
    });
  }, config.timeouts.defaultCheckMs);

  async function writeMetrics(res: http.ServerResponse): Promise<void> {
    const [loanCount, queuedRetries, ackLatencyMs] = await Promise.all([
      activeLoanCount(),
      retryQueueSize(),
      averageAckLatencyMs(),
    ]);

    const body = [
      "# HELP flashdot_active_loans Active non-terminal loans tracked by the coordinator.",
      "# TYPE flashdot_active_loans gauge",
      `flashdot_active_loans ${loanCount}`,
      "# HELP flashdot_retry_queue_size Pending retry queue items.",
      "# TYPE flashdot_retry_queue_size gauge",
      `flashdot_retry_queue_size ${queuedRetries}`,
      "# HELP flashdot_avg_ack_latency_ms Average ACK latency in milliseconds.",
      "# TYPE flashdot_avg_ack_latency_ms gauge",
      `flashdot_avg_ack_latency_ms ${ackLatencyMs}`,
      "# HELP flashdot_errors_total Coordinator loop errors observed since process start.",
      "# TYPE flashdot_errors_total counter",
      `flashdot_errors_total ${coordinatorMetrics.errorsTotal}`,
      "",
    ].join("\n");

    res.statusCode = 200;
    res.setHeader("content-type", "text/plain; version=0.0.4");
    res.end(body);
  }

  const server = http.createServer((req, res) => {
    if (req.method !== "GET") {
      res.statusCode = 404;
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ error: "not_found" }));
      return;
    }

    if (req.url === "/metrics") {
      void writeMetrics(res).catch((error) => {
        coordinatorMetrics.errorsTotal += 1;
        res.statusCode = 500;
        res.setHeader("content-type", "text/plain; version=0.0.4");
        res.end(`# metrics_error ${error instanceof Error ? error.message : String(error)}\n`);
      });
      return;
    }

    if (req.url !== "/health") {
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
        coordinatorMetrics.errorsTotal += 1;
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
  coordinatorMetrics.errorsTotal += 1;
  console.error("[coordinator] fatal error:", error);
  process.exit(1);
});
