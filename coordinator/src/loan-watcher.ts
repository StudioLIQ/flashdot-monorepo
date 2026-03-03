import { onCommittedAck } from "./lifecycle/on-committed-ack.js";
import { onLoanCreated } from "./lifecycle/on-loan-created.js";
import { onPreparedAck } from "./lifecycle/on-prepared-ack.js";
import { onRepayConfirmed } from "./lifecycle/on-repay-confirmed.js";
import type { HubContractLike } from "./lifecycle/shared.js";

export interface LoanWatcherHandle {
  stop: () => Promise<void>;
}

export async function startLoanWatcher(hubContract: HubContractLike): Promise<LoanWatcherHandle> {
  const ctx = { hubContract };

  const createdHandler = async (loanId: bigint): Promise<void> => {
    await onLoanCreated(ctx, loanId);
  };

  const preparedHandler = async (loanId: bigint, legId: bigint): Promise<void> => {
    await onPreparedAck(ctx, loanId, legId);
  };

  const committedHandler = async (loanId: bigint, legId: bigint): Promise<void> => {
    await onCommittedAck(ctx, loanId, legId);
  };

  const repaidHandler = async (loanId: bigint, legId: bigint): Promise<void> => {
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
