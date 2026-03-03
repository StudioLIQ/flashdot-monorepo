export const LoanState = {
  Created: 0,
  Preparing: 1,
  Prepared: 2,
  Committing: 3,
  Committed: 4,
  Repaying: 5,
  Settling: 6,
  Settled: 7,
  Aborted: 8,
  Defaulted: 9,
} as const;

export const LegState = {
  Init: 0,
  PrepareSent: 1,
  PreparedAcked: 2,
  CommitSent: 3,
  CommittedAcked: 4,
  RepaidConfirmed: 5,
  Aborted: 6,
  DefaultPaid: 7,
} as const;

export interface LoanView {
  loanId: string;
  state: number;
  repayOnlyMode: boolean;
  expiryAt: number;
  bondAmount: bigint;
  slashedAmount: bigint;
}

export interface LegView {
  loanId: string;
  legId: number;
  vault: string;
  amount: bigint;
  repayAmount: bigint;
  state: number;
  expiryAt: number;
}
