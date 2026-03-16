import { db } from "../db/index.js";
import { retryQueue } from "../db/schema.js";

export interface HubLoanData {
  borrower: string;
  asset: string;
  targetAmount: bigint;
  interestBps: number;
  createdAt: bigint;
  expiryAt: bigint;
  state: number;
  repayOnlyMode: boolean;
  planHash: string;
}

export interface HubBondInfoData {
  bondAmount: bigint;
  lockedAt: bigint;
  slashed: boolean;
}

export interface HubLegData {
  chain: string;
  vault: string;
  amount: bigint;
  feeBudget: bigint;
  legInterestBps: number;
  state: number;
}

export type LoanCreatedListener = (loanId: bigint) => Promise<void> | void;
export type LegAckListener = (loanId: bigint, legId: bigint) => Promise<void> | void;
export type HubEvent = "LoanCreated" | "PreparedAcked" | "CommittedAcked" | "RepayConfirmed";
export type HubEventListener = LoanCreatedListener | LegAckListener;

export interface HubContractLike {
  getLoan: (loanId: bigint) => Promise<HubLoanData>;
  getBondInfo: (loanId: bigint) => Promise<HubBondInfoData>;
  getLegCount: (loanId: bigint) => Promise<bigint>;
  getLeg: (loanId: bigint, legId: number) => Promise<HubLegData>;
  startPrepare: (loanId: bigint) => Promise<{ wait: () => Promise<unknown> }>;
  startCommit: (loanId: bigint) => Promise<{ wait: () => Promise<unknown> }>;
  finalizeSettle: (loanId: bigint) => Promise<{ wait: () => Promise<unknown> }>;
  on: (event: HubEvent, listener: HubEventListener) => void;
  off: (event: HubEvent, listener: HubEventListener) => void;
}

export interface LifecycleContext {
  hubContract: HubContractLike;
}

export function nowMs(): number {
  return Date.now();
}

export async function enqueueRetry(params: {
  loanId?: string;
  legId?: number;
  action: string;
  payload?: Record<string, unknown>;
  error: unknown;
}): Promise<void> {
  const now = nowMs();
  await db.insert(retryQueue).values({
    loanId: params.loanId,
    legId: params.legId,
    action: params.action,
    attempts: 0,
    nextRetryAt: now,
    lastError: params.error instanceof Error ? params.error.message : String(params.error),
    payload: params.payload ? JSON.stringify(params.payload) : null,
    createdAt: now,
    updatedAt: now,
  });
}
