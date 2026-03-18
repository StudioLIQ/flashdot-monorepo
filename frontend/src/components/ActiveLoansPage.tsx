"use client";

import { useMemo } from "react";

import { useLoan } from "../hooks/useLoan";
import { useLoanHistory } from "../hooks/useLoanHistory";
import { useMyLoans } from "../hooks/useMyLoans";
import { useWallet } from "../hooks/useWallet";
import { LoanState } from "../lib/loan-types";
import { LoanStatus } from "./LoanStatus";
import { Skeleton } from "./Skeleton";

export function ActiveLoansPage(): JSX.Element {
  const { account, isConnected } = useWallet();

  const myLoansQuery = useMyLoans(account);
  const loanHistoryQuery = useLoanHistory(account);

  const activeLoanId = useMemo(() => {
    const list = myLoansQuery.data ?? [];
    if (!list.length) return null;
    const active = list.find(
      (loan) =>
        loan.state !== LoanState.Settled &&
        loan.state !== LoanState.Defaulted &&
        loan.state !== LoanState.Aborted
    );
    return (active ?? list[0])?.loanId ?? null;
  }, [myLoansQuery.data]);

  const activeLoanQuery = useLoan(activeLoanId);
  const statusLoading = Boolean(
    isConnected && (myLoansQuery.isLoading || activeLoanQuery.isLoading)
  );

  if (!isConnected) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-6 md:px-6 md:py-8">
        <div className="rounded-2xl border border-ink/10 bg-white/75 p-8 text-center backdrop-blur dark:border-white/10 dark:bg-slate-950/65">
          <p className="text-sm font-semibold text-ink/70 dark:text-white/65">
            Connect wallet to view active loans.
          </p>
        </div>
      </main>
    );
  }

  if (statusLoading) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-6 md:px-6 md:py-8">
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} height={56} />
          ))}
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 md:px-6 md:py-8 animate-content-fade">
      <LoanStatus
        loan={activeLoanQuery.data?.loan ?? null}
        legs={activeLoanQuery.data?.legs ?? []}
        loading={statusLoading}
        refreshing={activeLoanQuery.isFetching || myLoansQuery.isFetching}
        onRepaid={() => {
          void activeLoanQuery.refetch();
          void myLoansQuery.refetch();
          void loanHistoryQuery.refetch();
        }}
      />
    </main>
  );
}
