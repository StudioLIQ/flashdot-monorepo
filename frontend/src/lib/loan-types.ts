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

export interface StatusMeta {
  label: string;
  icon: string;
}

export const LOAN_STATE_META: Record<number, StatusMeta> = {
  [LoanState.Created]: { label: "Loan Created", icon: "✅" },
  [LoanState.Preparing]: { label: "Locking Liquidity...", icon: "🔒" },
  [LoanState.Prepared]: { label: "Liquidity Locked", icon: "🔐" },
  [LoanState.Committing]: { label: "Disbursing Funds...", icon: "➡️" },
  [LoanState.Committed]: { label: "Funds Received", icon: "📥" },
  [LoanState.Repaying]: { label: "Repaying Vaults...", icon: "🔄" },
  [LoanState.Settling]: { label: "Finalizing...", icon: "⏳" },
  [LoanState.Settled]: { label: "Complete", icon: "✅✅" },
  [LoanState.Aborted]: { label: "Cancelled", icon: "⛔" },
  [LoanState.Defaulted]: { label: "Defaulted (Bond Slashed)", icon: "⚠️" },
};

export const LEG_STEP_META: ReadonlyArray<{
  state: number;
  label: string;
  icon: string;
}> = [
  { state: LegState.PrepareSent, label: "Requesting Lock", icon: "🔒" },
  { state: LegState.PreparedAcked, label: "Lock Confirmed", icon: "✅" },
  { state: LegState.CommitSent, label: "Disbursing", icon: "➡️" },
  { state: LegState.CommittedAcked, label: "Funds Sent", icon: "📤" },
  { state: LegState.RepaidConfirmed, label: "Repaid", icon: "💸" },
];

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
