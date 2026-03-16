import { and, eq, lte, or } from "drizzle-orm";

import { config } from "./config.js";
import { db } from "./db/index.js";
import { legs, loans, retryQueue } from "./db/schema.js";
import { LegState, LoanState } from "./lifecycle/constants.js";

export interface HubTimeoutContract {
  cancelBeforeCommit: (loanId: bigint) => Promise<{ wait: () => Promise<unknown> }>;
  enforceCommitTimeout: (loanId: bigint) => Promise<{ wait: () => Promise<unknown> }>;
  triggerDefault: (loanId: bigint) => Promise<{ wait: () => Promise<unknown> }>;
}

async function queueTimeoutRetry(
  loanId: string,
  action: "cancelBeforeCommit" | "enforceCommitTimeout" | "triggerDefault",
  error: unknown
): Promise<void> {
  const now = Date.now();
  await db.insert(retryQueue).values({
    loanId,
    legId: null,
    action,
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
    .where(
      and(
        or(eq(loans.state, LoanState.Committed), eq(loans.repayOnlyMode, true)),
        lte(loans.expiryAt, nowSec)
      )
    );

  for (const row of expired) {
    try {
      const tx = await hubContract.triggerDefault(BigInt(row.loanId));
      await tx.wait();

      await db
        .update(loans)
        .set({ state: LoanState.Defaulted, updatedAt: Date.now() })
        .where(eq(loans.loanId, row.loanId));
    } catch (error) {
      await queueTimeoutRetry(row.loanId, "triggerDefault", error);
    }
  }
}

export async function checkPrepareTimeouts(hubContract: HubTimeoutContract): Promise<void> {
  const cutoff = Date.now() - config.timeouts.prepareMs;
  const stuckPreparing = await db
    .select()
    .from(loans)
    .where(
      and(
        or(eq(loans.state, LoanState.Preparing), eq(loans.state, LoanState.Prepared)),
        lte(loans.updatedAt, cutoff)
      )
    );

  for (const row of stuckPreparing) {
    try {
      const tx = await hubContract.cancelBeforeCommit(BigInt(row.loanId));
      await tx.wait();

      const updatedAt = Date.now();
      await db.transaction(async (dbTx) => {
        await dbTx
          .update(loans)
          .set({ state: LoanState.Aborted, updatedAt })
          .where(eq(loans.loanId, row.loanId));

        await dbTx
          .update(legs)
          .set({ state: LegState.Aborted, updatedAt })
          .where(eq(legs.loanId, row.loanId));
      });
    } catch (error) {
      await queueTimeoutRetry(row.loanId, "cancelBeforeCommit", error);
    }
  }
}

export async function checkCommitTimeouts(hubContract: HubTimeoutContract): Promise<void> {
  const cutoff = Date.now() - config.timeouts.commitMs;
  const stuckCommitting = await db
    .select()
    .from(loans)
    .where(and(eq(loans.state, LoanState.Committing), lte(loans.updatedAt, cutoff)));

  for (const row of stuckCommitting) {
    try {
      const tx = await hubContract.enforceCommitTimeout(BigInt(row.loanId));
      await tx.wait();

      const updatedAt = Date.now();
      await db.transaction(async (dbTx) => {
        await dbTx
          .update(loans)
          .set({ repayOnlyMode: true, updatedAt })
          .where(eq(loans.loanId, row.loanId));

        await dbTx
          .update(legs)
          .set({ state: LegState.Aborted, updatedAt })
          .where(and(eq(legs.loanId, row.loanId), eq(legs.state, LegState.PreparedAcked)));
      });
    } catch (error) {
      await queueTimeoutRetry(row.loanId, "enforceCommitTimeout", error);
    }
  }
}

export async function runTimeoutEnforcer(hubContract: HubTimeoutContract): Promise<void> {
  await Promise.all([
    checkExpiredLoans(hubContract),
    checkPrepareTimeouts(hubContract),
    checkCommitTimeouts(hubContract),
  ]);
}
