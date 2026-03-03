import { db } from "../db/index.js";
import { retryQueue } from "../db/schema.js";

export interface HubContractLike {
  getLoan: (loanId: bigint) => Promise<any>;
  getBondInfo: (loanId: bigint) => Promise<any>;
  getLegCount: (loanId: bigint) => Promise<any>;
  getLeg: (loanId: bigint, legId: number) => Promise<any>;
  startPrepare: (loanId: bigint) => Promise<{ wait: () => Promise<unknown> }>;
  startCommit: (loanId: bigint) => Promise<{ wait: () => Promise<unknown> }>;
  finalizeSettle: (loanId: bigint) => Promise<{ wait: () => Promise<unknown> }>;
  on: (event: string, listener: (...args: any[]) => unknown) => void;
  off: (event: string, listener: (...args: any[]) => unknown) => void;
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
