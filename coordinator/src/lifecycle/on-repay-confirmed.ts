import { and, eq } from "drizzle-orm";

import { db } from "../db/index.js";
import { legs, loans } from "../db/schema.js";
import { LegState, LoanState } from "./constants.js";
import { enqueueRetry, LifecycleContext, nowMs } from "./shared.js";

export async function onRepayConfirmed(
  ctx: LifecycleContext,
  loanIdRaw: bigint,
  legIdRaw: bigint
): Promise<void> {
  const loanId = loanIdRaw.toString();
  const legId = Number(legIdRaw);

  try {
    const hasUnpaidCommittedLeg = await db.transaction(async (tx) => {
      const updatedAt = nowMs();
      await tx
        .update(legs)
        .set({ state: LegState.RepaidConfirmed, updatedAt })
        .where(and(eq(legs.loanId, loanId), eq(legs.legId, legId)));

      await tx
        .update(loans)
        .set({ state: LoanState.Repaying, updatedAt })
        .where(eq(loans.loanId, loanId));

      const allLegs = await tx
        .select({ state: legs.state })
        .from(legs)
        .where(eq(legs.loanId, loanId));

      return allLegs.some((row) => row.state === LegState.CommittedAcked);
    });

    if (!hasUnpaidCommittedLeg) {
      const finalizeTx = await ctx.hubContract.finalizeSettle(loanIdRaw);
      await finalizeTx.wait();

      await db
        .update(loans)
        .set({ state: LoanState.Settled, updatedAt: nowMs() })
        .where(eq(loans.loanId, loanId));
    }
  } catch (error) {
    await enqueueRetry({
      action: "finalizeSettle",
      loanId,
      legId,
      payload: { loanId, legId },
      error,
    });
    throw error;
  }
}
