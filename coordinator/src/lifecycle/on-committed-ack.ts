import { and, eq } from "drizzle-orm";

import { db } from "../db/index.js";
import { legs, loans } from "../db/schema.js";
import { LegState, LoanState } from "./constants.js";
import { enqueueRetry, LifecycleContext, nowMs } from "./shared.js";

export async function onCommittedAck(
  _ctx: LifecycleContext,
  loanIdRaw: bigint,
  legIdRaw: bigint
): Promise<void> {
  const loanId = loanIdRaw.toString();
  const legId = Number(legIdRaw);

  try {
    await db.transaction(async (tx) => {
      const updatedAt = nowMs();
      await tx
        .update(legs)
        .set({ state: LegState.CommittedAcked, updatedAt })
        .where(and(eq(legs.loanId, loanId), eq(legs.legId, legId)));

      const allLegs = await tx
        .select({ state: legs.state })
        .from(legs)
        .where(eq(legs.loanId, loanId));

      const isCommitted = allLegs.every((row) =>
        row.state === LegState.CommittedAcked || row.state === LegState.Aborted
      );

      await tx
        .update(loans)
        .set({
          state: isCommitted ? LoanState.Committed : LoanState.Committing,
          updatedAt,
        })
        .where(eq(loans.loanId, loanId));
    });
  } catch (error) {
    await enqueueRetry({
      action: "updateCommittedAck",
      loanId,
      legId,
      payload: { loanId, legId },
      error,
    });
    throw error;
  }
}
