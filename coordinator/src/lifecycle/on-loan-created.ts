import { eq } from "drizzle-orm";

import { db } from "../db/index.js";
import { legs, loans } from "../db/schema.js";
import { LoanState } from "./constants.js";
import { enqueueRetry, LifecycleContext, nowMs } from "./shared.js";

function toBigIntString(value: unknown): string {
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "number") return Math.trunc(value).toString();
  return String(value);
}

function normalizeAddress(value: unknown): string {
  return String(value);
}

export async function onLoanCreated(ctx: LifecycleContext, loanIdRaw: bigint): Promise<void> {
  const loanId = loanIdRaw.toString();

  try {
    const now = nowMs();
    const [loan, bondInfo, legCountRaw] = await Promise.all([
      ctx.hubContract.getLoan(loanIdRaw),
      ctx.hubContract.getBondInfo(loanIdRaw),
      ctx.hubContract.getLegCount(loanIdRaw),
    ]);

    const legCount = Number(legCountRaw);

    await db
      .insert(loans)
      .values({
        loanId,
        borrower: normalizeAddress(loan.borrower),
        state: Number(loan.state),
        bondAmount: toBigIntString(bondInfo.bondAmount),
        expiryAt: Number(loan.expiryAt),
        repayOnlyMode: Boolean(loan.repayOnlyMode),
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: loans.loanId,
        set: {
          state: Number(loan.state),
          bondAmount: toBigIntString(bondInfo.bondAmount),
          expiryAt: Number(loan.expiryAt),
          repayOnlyMode: Boolean(loan.repayOnlyMode),
          updatedAt: now,
        },
      });

    for (let legId = 0; legId < legCount; legId += 1) {
      const leg = await ctx.hubContract.getLeg(loanIdRaw, legId);
      await db
        .insert(legs)
        .values({
          loanId,
          legId,
          chain: String(leg.chain),
          vault: normalizeAddress(leg.vault),
          amount: toBigIntString(leg.amount),
          state: Number(leg.state),
          lastXcmQueryId: null,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [legs.loanId, legs.legId],
          set: {
            chain: String(leg.chain),
            vault: normalizeAddress(leg.vault),
            amount: toBigIntString(leg.amount),
            state: Number(leg.state),
            updatedAt: now,
          },
        });
    }

    const startPrepareTx = await ctx.hubContract.startPrepare(loanIdRaw);
    await startPrepareTx.wait();

    await db
      .update(loans)
      .set({ state: LoanState.Preparing, updatedAt: nowMs() })
      .where(eq(loans.loanId, loanId));
  } catch (error) {
    await enqueueRetry({
      action: "startPrepare",
      loanId,
      payload: { loanId },
      error,
    });
    throw error;
  }
}
