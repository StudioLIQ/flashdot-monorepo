import { and, eq, lte } from "drizzle-orm";

import { config } from "./config.js";
import { db } from "./db/index.js";
import { loans, retryQueue } from "./db/schema.js";
import { LoanState } from "./lifecycle/constants.js";

interface HubTimeoutContract {
  triggerDefault: (loanId: bigint) => Promise<{ wait: () => Promise<unknown> }>;
}

async function queueDefaultRetry(loanId: string, error: unknown): Promise<void> {
  const now = Date.now();
  await db.insert(retryQueue).values({
    loanId,
    legId: null,
    action: "triggerDefault",
    attempts: 0,
    nextRetryAt: now,
    lastError: error instanceof Error ? error.message : String(error),
    payload: JSON.stringify({ loanId }),
    createdAt: now,
    updatedAt: now,
  });
}

export async function checkExpiredLoans(hubContract: HubTimeoutContract): Promise<void> {
  const nowSec = Math.floor(Date.now() / 1000);
  const expired = await db
    .select()
    .from(loans)
    .where(and(eq(loans.state, LoanState.Committed), lte(loans.expiryAt, nowSec)));

  for (const row of expired) {
    try {
      const tx = await hubContract.triggerDefault(BigInt(row.loanId));
      await tx.wait();

      await db
        .update(loans)
        .set({ state: LoanState.Defaulted, updatedAt: Date.now() })
        .where(eq(loans.loanId, row.loanId));
    } catch (error) {
      await queueDefaultRetry(row.loanId, error);
    }
  }
}

export async function checkPrepareTimeouts(): Promise<void> {
  const cutoff = Date.now() - config.timeouts.prepareMs;
  const stuckPreparing = await db
    .select()
    .from(loans)
    .where(and(eq(loans.state, LoanState.Preparing), lte(loans.updatedAt, cutoff)));

  for (const row of stuckPreparing) {
    console.warn(`[timeout] loan ${row.loanId} stuck in Preparing for > ${config.timeouts.prepareMs}ms`);
  }
}

export async function checkCommitTimeouts(): Promise<void> {
  const cutoff = Date.now() - config.timeouts.commitMs;
  const stuckCommitting = await db
    .select()
    .from(loans)
    .where(and(eq(loans.state, LoanState.Committing), lte(loans.updatedAt, cutoff)));

  for (const row of stuckCommitting) {
    console.warn(`[timeout] loan ${row.loanId} stuck in Committing for > ${config.timeouts.commitMs}ms`);
  }
}

export async function runTimeoutEnforcer(hubContract: HubTimeoutContract): Promise<void> {
  await Promise.all([
    checkExpiredLoans(hubContract),
    checkPrepareTimeouts(),
    checkCommitTimeouts(),
  ]);
}
