"use client";

import { formatEther } from "ethers";
import { Activity, PlusCircle } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

import { useMyLoans } from "../hooks/useMyLoans";
import { useWallet } from "../hooks/useWallet";
import { LOAN_STATE_META, LoanState, type LoanView } from "../lib/loan-types";
import { EmptyState } from "./EmptyState";
import { Skeleton } from "./Skeleton";

const LOAN_PROGRESS: Record<number, number> = {
  [LoanState.Created]: 10,
  [LoanState.Preparing]: 25,
  [LoanState.Prepared]: 40,
  [LoanState.Committing]: 55,
  [LoanState.Committed]: 70,
  [LoanState.Repaying]: 85,
  [LoanState.Settling]: 92,
  [LoanState.Settled]: 100,
  [LoanState.Aborted]: 100,
  [LoanState.Defaulted]: 100,
};

function isActive(state: number): boolean {
  return (
    state !== LoanState.Settled &&
    state !== LoanState.Defaulted &&
    state !== LoanState.Aborted
  );
}

function formatDot(amount: bigint): string {
  return `${Number(formatEther(amount)).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  })} DOT`;
}

function formatRelative(seconds: number): string {
  const now = Math.floor(Date.now() / 1000);
  const delta = seconds - now;
  if (delta <= 0) return "Expired";
  if (delta < 60) return `${delta}s left`;
  if (delta < 3600) return `${Math.floor(delta / 60)}m left`;
  return `${Math.floor(delta / 3600)}h left`;
}

function statusTone(state: number): string {
  if (state === LoanState.Committed || state === LoanState.Repaying)
    return "bg-success/15 text-success";
  if (state === LoanState.Preparing || state === LoanState.Committing)
    return "bg-info/15 text-info";
  if (state === LoanState.Settled) return "bg-success/15 text-success";
  if (state === LoanState.Defaulted) return "bg-danger/15 text-danger";
  if (state === LoanState.Aborted) return "bg-ink/10 text-ink/60 dark:bg-white/10 dark:text-white/55";
  return "bg-primary/15 text-primary";
}

interface LoanCardProps {
  loan: LoanView;
}

function LoanCard({ loan }: LoanCardProps): JSX.Element {
  const meta = LOAN_STATE_META[loan.state];
  const progress = LOAN_PROGRESS[loan.state] ?? 0;
  const timeLeft = loan.expiryAt > 0 ? formatRelative(loan.expiryAt) : "—";

  return (
    <Link
      href={`/loans/${loan.loanId}`}
      className="group block rounded-2xl border border-ink/10 bg-white/80 p-4 backdrop-blur transition hover:border-primary/30 hover:bg-white dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/8"
    >
      {/* Top row */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Activity size={16} className="shrink-0 text-primary" />
          <span className="font-mono text-sm font-semibold">Loan #{loan.loanId}</span>
        </div>
        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusTone(loan.state)}`}>
          {meta?.label ?? `State ${loan.state}`}
        </span>
      </div>

      {/* Bond + time */}
      <div className="mt-2 flex items-center justify-between gap-3">
        <p className="font-mono text-sm text-ink/80 dark:text-white/75">
          {formatDot(loan.bondAmount)} bonded
        </p>
        <p className="text-xs text-ink/55 dark:text-white/45">{timeLeft}</p>
      </div>

      {/* Progress bar */}
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-ink/10 dark:bg-white/10">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500"
          style={{ width: `${progress}%` }}
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
    </Link>
  );
}

export function ActiveLoansPage(): JSX.Element {
  const { account, isConnected } = useWallet();
  const myLoansQuery = useMyLoans(account);

  const activeLoans = useMemo(
    () => (myLoansQuery.data ?? []).filter((l) => isActive(l.state)),
    [myLoansQuery.data]
  );

  if (!isConnected) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-8 md:px-6">
        <div className="rounded-2xl border border-ink/10 bg-white/75 p-8 text-center backdrop-blur dark:border-white/10 dark:bg-white/5">
          <p className="text-sm font-semibold text-ink/70 dark:text-white/65">
            Connect wallet to view active loans.
          </p>
        </div>
      </main>
    );
  }

  if (myLoansQuery.isLoading) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-8 md:px-6">
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} height={104} />
          ))}
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 md:px-6 animate-content-fade">
      {/* Page header */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold">Active Loans</h1>
          <p className="mt-0.5 text-sm text-ink/65 dark:text-white/55">
            {activeLoans.length > 0
              ? `${activeLoans.length} loan${activeLoans.length > 1 ? "s" : ""} in progress`
              : "No active loans"}
          </p>
        </div>
        <Link
          href="/create"
          className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-fg transition hover:bg-primary-hover"
        >
          <PlusCircle size={15} />
          New Loan
        </Link>
      </div>

      {activeLoans.length === 0 ? (
        <EmptyState
          illustration="no-loans"
          title="No active loans"
          description="Start by creating a bonded flash loan. One signature locks the bond and begins execution."
          action={{ label: "Create New Loan", href: "/create" }}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {activeLoans.map((loan) => (
            <LoanCard key={loan.loanId} loan={loan} />
          ))}
        </div>
      )}
    </main>
  );
}

