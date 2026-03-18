import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  ArrowRight,
  Ban,
  CheckCircle2,
  CircleDollarSign,
  Download,
  Lock,
  LockKeyhole,
  RefreshCw,
  Send,
  Timer,
} from "lucide-react";

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
  icon: LucideIcon;
}

export const LOAN_STATE_META: Record<number, StatusMeta> = {
  [LoanState.Created]: { label: "Loan Created", icon: CheckCircle2 },
  [LoanState.Preparing]: { label: "Locking Liquidity...", icon: Lock },
  [LoanState.Prepared]: { label: "Liquidity Locked", icon: LockKeyhole },
  [LoanState.Committing]: { label: "Disbursing Funds...", icon: ArrowRight },
  [LoanState.Committed]: { label: "Funds Received", icon: Download },
  [LoanState.Repaying]: { label: "Repaying Vaults...", icon: RefreshCw },
  [LoanState.Settling]: { label: "Finalizing...", icon: Timer },
  [LoanState.Settled]: { label: "Complete", icon: CheckCircle2 },
  [LoanState.Aborted]: { label: "Cancelled", icon: Ban },
  [LoanState.Defaulted]: { label: "Defaulted (Bond Slashed)", icon: AlertTriangle },
};

export const LEG_STEP_META: ReadonlyArray<{
  state: number;
  label: string;
  icon: LucideIcon;
}> = [
  { state: LegState.PrepareSent, label: "Requesting Lock", icon: Lock },
  { state: LegState.PreparedAcked, label: "Lock Confirmed", icon: CheckCircle2 },
  { state: LegState.CommitSent, label: "Disbursing", icon: ArrowRight },
  { state: LegState.CommittedAcked, label: "Funds Sent", icon: Send },
  { state: LegState.RepaidConfirmed, label: "Repaid", icon: CircleDollarSign },
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
