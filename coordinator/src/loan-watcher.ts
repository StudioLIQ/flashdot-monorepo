import { and, eq } from "drizzle-orm";

import { db } from "./db/index.js";
import { xcmEvents } from "./db/schema.js";
import { onCommittedAck } from "./lifecycle/on-committed-ack.js";
import { onLoanCreated } from "./lifecycle/on-loan-created.js";
import { onPreparedAck } from "./lifecycle/on-prepared-ack.js";
import { onRepayConfirmed } from "./lifecycle/on-repay-confirmed.js";
import type { HubContractLike } from "./lifecycle/shared.js";

export interface LoanWatcherHandle {
  stop: () => Promise<void>;
}

interface EventPayloadLike {
  log: {
    transactionHash: string;
    index: number;
  };
}

function extractEventRef(payload: unknown): { txHash: string; logIndex: number } | null {
  if (!payload || typeof payload !== "object" || !("log" in payload)) {
    return null;
  }

  const log = (payload as EventPayloadLike).log;
  if (
    !log ||
    typeof log.transactionHash !== "string" ||
    !Number.isInteger(log.index)
  ) {
    return null;
  }

  return {
    txHash: log.transactionHash,
    logIndex: log.index,
  };
}

async function shouldProcessEvent(
  eventName: string,
  loanId: string,
  legId: number,
  payload: unknown
): Promise<boolean> {
  const ref = extractEventRef(payload);
  if (!ref) {
    return true;
  }

  const existing = await db
    .select({ queryId: xcmEvents.queryId })
    .from(xcmEvents)
    .where(and(eq(xcmEvents.txHash, ref.txHash), eq(xcmEvents.logIndex, ref.logIndex)));

  if (existing.length > 0) {
    return false;
  }

  const now = Date.now();
  await db.insert(xcmEvents).values({
    queryId: `${ref.txHash}:${ref.logIndex}`,
    loanId,
    legId,
    phase: eventName,
    txHash: ref.txHash,
    logIndex: ref.logIndex,
    sentAt: now,
    ackedAt: now,
  });

  return true;
}

export async function startLoanWatcher(hubContract: HubContractLike): Promise<LoanWatcherHandle> {
  const ctx = { hubContract };

  const createdHandler = async (loanId: bigint, ...args: unknown[]): Promise<void> => {
    if (!(await shouldProcessEvent("LoanCreated", loanId.toString(), -1, args.at(-1)))) {
      return;
    }
    await onLoanCreated(ctx, loanId);
  };

  const preparedHandler = async (loanId: bigint, legId: bigint, ...args: unknown[]): Promise<void> => {
    if (!(await shouldProcessEvent("PreparedAcked", loanId.toString(), Number(legId), args.at(-1)))) {
      return;
    }
    await onPreparedAck(ctx, loanId, legId);
  };

  const committedHandler = async (loanId: bigint, legId: bigint, ...args: unknown[]): Promise<void> => {
    if (!(await shouldProcessEvent("CommittedAcked", loanId.toString(), Number(legId), args.at(-1)))) {
      return;
    }
    await onCommittedAck(ctx, loanId, legId);
  };

  const repaidHandler = async (loanId: bigint, legId: bigint, ...args: unknown[]): Promise<void> => {
    if (!(await shouldProcessEvent("RepayConfirmed", loanId.toString(), Number(legId), args.at(-1)))) {
      return;
    }
    await onRepayConfirmed(ctx, loanId, legId);
  };

  hubContract.on("LoanCreated", createdHandler);
  hubContract.on("PreparedAcked", preparedHandler);
  hubContract.on("CommittedAcked", committedHandler);
  hubContract.on("RepayConfirmed", repaidHandler);

  return {
    stop: async () => {
      hubContract.off("LoanCreated", createdHandler);
      hubContract.off("PreparedAcked", preparedHandler);
      hubContract.off("CommittedAcked", committedHandler);
      hubContract.off("RepayConfirmed", repaidHandler);
    },
  };
}
