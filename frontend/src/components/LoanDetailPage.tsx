"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { useLoan } from "../hooks/useLoan";
import { useLoanHistory } from "../hooks/useLoanHistory";
import { useMyLoans } from "../hooks/useMyLoans";
import { useWallet } from "../hooks/useWallet";
import { LoanStatus } from "./LoanStatus";
import { Skeleton } from "./Skeleton";

interface LoanDetailPageProps {
  loanId: string;
}

export function LoanDetailPage({ loanId }: LoanDetailPageProps): JSX.Element {
  const { account, isConnected } = useWallet();
  const myLoansQuery = useMyLoans(account);
  const loanHistoryQuery = useLoanHistory(account);
  const loanQuery = useLoan(loanId);

  if (!isConnected) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-6 md:px-6 md:py-8">
        <div className="rounded-2xl border border-ink/10 bg-white/75 p-8 text-center backdrop-blur dark:border-white/10 dark:bg-slate-950/65">
          <p className="text-sm font-semibold text-ink/70 dark:text-white/65">
            Connect wallet to view loan detail.
          </p>
        </div>
      </main>
    );
  }

  if (loanQuery.isLoading) {
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
      <div className="mb-4">
        <Link
          href="/loans"
          className="inline-flex items-center gap-1.5 text-sm text-ink/60 hover:text-ink dark:text-white/55 dark:hover:text-white"
        >
          <ArrowLeft size={14} />
          All Loans
        </Link>
      </div>
      <LoanStatus
        loan={loanQuery.data?.loan ?? null}
        legs={loanQuery.data?.legs ?? []}
        loading={loanQuery.isLoading}
        refreshing={loanQuery.isFetching}
        onRepaid={() => {
          void loanQuery.refetch();
          void myLoansQuery.refetch();
          void loanHistoryQuery.refetch();
        }}
      />
    </main>
  );
}
