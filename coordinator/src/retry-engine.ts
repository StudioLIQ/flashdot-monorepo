import { and, eq, lte } from "drizzle-orm";

import { config } from "./config.js";
import { db } from "./db/index.js";
import { legs, loans, retryQueue } from "./db/schema.js";

type RetryAction =
  | "startPrepare"
  | "startCommit"
  | "finalizeSettle"
  | "triggerDefault"
  | "updateCommittedAck";

interface RetryPayload {
  loanId?: string;
  legId?: number;
}

export interface HubRetryContract {
  getLoan: (loanId: bigint) => Promise<{ state: number }>;
  getLeg: (loanId: bigint, legId: number) => Promise<{ state: number }>;
  startPrepare: (loanId: bigint) => Promise<{ wait: () => Promise<unknown> }>;
  startCommit: (loanId: bigint) => Promise<{ wait: () => Promise<unknown> }>;
  finalizeSettle: (loanId: bigint) => Promise<{ wait: () => Promise<unknown> }>;
  triggerDefault: (loanId: bigint) => Promise<{ wait: () => Promise<unknown> }>;
}

function nowMs(): number {
  return Date.now();
}

const ACTION_EXECUTORS: Record<RetryAction, (hub: HubRetryContract, payload: RetryPayload) => Promise<void>> = {
  startPrepare: async (hub, payload) => {
    const loanId = toLoanId(payload);
    if (loanId === null) {
      throw new Error("retry payload missing loanId");
    }
    const tx = await hub.startPrepare(loanId);
    await tx.wait();
  },
  startCommit: async (hub, payload) => {
    const loanId = toLoanId(payload);
    if (loanId === null) {
      throw new Error("retry payload missing loanId");
    }
    const tx = await hub.startCommit(loanId);
    await tx.wait();
  },
  finalizeSettle: async (hub, payload) => {
    const loanId = toLoanId(payload);
    if (loanId === null) {
      throw new Error("retry payload missing loanId");
    }
    const tx = await hub.finalizeSettle(loanId);
    await tx.wait();
  },
  triggerDefault: async (hub, payload) => {
    const loanId = toLoanId(payload);
    if (loanId === null) {
      throw new Error("retry payload missing loanId");
    }
    const tx = await hub.triggerDefault(loanId);
    await tx.wait();
  },
  updateCommittedAck: async (hub, payload) => {
    const loanId = toLoanId(payload);
    const legId = toLegId(payload);
    if (loanId === null || legId === null) {
      throw new Error("retry payload missing loanId/legId");
    }

    const [loan, leg] = await Promise.all([
      hub.getLoan(loanId),
      hub.getLeg(loanId, legId),
    ]);
    const updatedAt = nowMs();

    await db
      .update(legs)
      .set({ state: Number(leg.state), updatedAt })
      .where(and(eq(legs.loanId, loanId.toString()), eq(legs.legId, legId)));

    await db
      .update(loans)
      .set({ state: Number(loan.state), updatedAt })
      .where(eq(loans.loanId, loanId.toString()));
  },
};

function parsePayload(raw: string | null): RetryPayload {
  if (!raw) return {};

  try {
    return JSON.parse(raw) as RetryPayload;
  } catch {
    return {};
  }
}

function toLoanId(payload: RetryPayload): bigint | null {
  if (!payload.loanId) return null;

  try {
    return BigInt(payload.loanId);
  } catch {
    return null;
  }
}

function toLegId(payload: RetryPayload): number | null {
  if (payload.legId === undefined) return null;
  return Number.isInteger(payload.legId) ? payload.legId : null;
}

function nextDelayMs(nextAttempt: number): number {
  const delays = config.retry.backoffMs;
  const index = Math.min(Math.max(nextAttempt - 1, 0), delays.length - 1);
  return delays[index] ?? 60_000;
}

export async function processRetryQueue(hubContract: HubRetryContract): Promise<void> {
  const now = Date.now();
  const dueItems = await db
    .select()
    .from(retryQueue)
    .where(lte(retryQueue.nextRetryAt, now));

  for (const item of dueItems) {
    const action = item.action as RetryAction;
    const payload = parsePayload(item.payload);

    if (!(action in ACTION_EXECUTORS)) {
      console.error(`[retry] drop invalid queue item id=${item.id} action=${item.action}`);
      await db.delete(retryQueue).where(eq(retryQueue.id, item.id));
      continue;
    }

    if (item.attempts >= config.retry.maxRetries) {
      console.error(`[retry] max retries exceeded id=${item.id} action=${item.action}`);
      await db.delete(retryQueue).where(eq(retryQueue.id, item.id));
      continue;
    }

    try {
      await ACTION_EXECUTORS[action](hubContract, payload);
      await db.delete(retryQueue).where(eq(retryQueue.id, item.id));
    } catch (error) {
      const attempts = item.attempts + 1;
      if (attempts >= config.retry.maxRetries) {
        console.error(`[retry] giving up id=${item.id} action=${item.action}:`, error);
        await db.delete(retryQueue).where(eq(retryQueue.id, item.id));
        continue;
      }

      const delayMs = nextDelayMs(attempts);
      await db
        .update(retryQueue)
        .set({
          attempts,
          nextRetryAt: Date.now() + delayMs,
          lastError: error instanceof Error ? error.message : String(error),
          updatedAt: Date.now(),
        })
        .where(eq(retryQueue.id, item.id));
    }
  }
}
