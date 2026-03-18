"use client";

import { useLoanHistory } from "../hooks/useLoanHistory";
import { useWallet } from "../hooks/useWallet";
import { LoanHistory } from "./LoanHistory";
import { Skeleton } from "./Skeleton";

export function LoanHistoryPage(): JSX.Element {
  const { account, isConnected } = useWallet();
  const loanHistoryQuery = useLoanHistory(account);

  if (!isConnected) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-6 md:px-6 md:py-8">
        <div className="rounded-2xl border border-ink/10 bg-white/75 p-8 text-center backdrop-blur dark:border-white/10 dark:bg-slate-950/65">
          <p className="text-sm font-semibold text-ink/70 dark:text-white/65">
            Connect wallet to view loan history.
          </p>
        </div>
      </main>
    );
  }

  if (loanHistoryQuery.isLoading) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-6 md:px-6 md:py-8">
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} height={56} />
          ))}
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 md:px-6 md:py-8 animate-content-fade">
      <div className="mb-6">
        <h1 className="page-title">Loan History</h1>
        <p className="page-subtitle">
          Settled, defaulted, and aborted loans from your account.
        </p>
      </div>
      <LoanHistory loans={loanHistoryQuery.data ?? []} loading={false} />
    </main>
  );
}
