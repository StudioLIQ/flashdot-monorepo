import { and, eq } from "drizzle-orm";

import { db } from "../db/index.js";
import { legs, loans } from "../db/schema.js";
import { LegState, LoanState } from "./constants.js";
import { enqueueRetry, LifecycleContext, nowMs } from "./shared.js";

export async function onPreparedAck(
  ctx: LifecycleContext,
  loanIdRaw: bigint,
  legIdRaw: bigint
): Promise<void> {
  const loanId = loanIdRaw.toString();
  const legId = Number(legIdRaw);

  try {
    await db
      .update(legs)
      .set({ state: LegState.PreparedAcked, updatedAt: nowMs() })
      .where(and(eq(legs.loanId, loanId), eq(legs.legId, legId)));

    await db
      .update(loans)
      .set({ state: LoanState.Preparing, updatedAt: nowMs() })
      .where(eq(loans.loanId, loanId));

    const allLegs = await db
      .select({ state: legs.state })
      .from(legs)
      .where(eq(legs.loanId, loanId));

    if (allLegs.length > 0 && allLegs.every((row) => row.state === LegState.PreparedAcked)) {
      const startCommitTx = await ctx.hubContract.startCommit(loanIdRaw);
      await startCommitTx.wait();

      await db
        .update(loans)
        .set({ state: LoanState.Committing, updatedAt: nowMs() })
        .where(eq(loans.loanId, loanId));
    }
  } catch (error) {
    await enqueueRetry({
      action: "startCommit",
      loanId,
      legId,
      payload: { loanId, legId },
      error,
    });
    throw error;
  }
}
