"use client";

import { Activity, PlusCircle, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useCallback, useMemo } from "react";

import { useMyLoans } from "../hooks/useMyLoans";
import { usePullToRefresh } from "../hooks/usePullToRefresh";
import { useWallet } from "../hooks/useWallet";
import { LOAN_STATE_META, LoanState, type LoanView } from "../lib/loan-types";

const LOAN_ACTION_HINT: Record<number, string> = {
  [LoanState.Created]: "Starting up...",
  [LoanState.Preparing]: "Locking liquidity on chain",
  [LoanState.Prepared]: "Awaiting fund disbursement",
  [LoanState.Committing]: "Disbursing funds to wallet",
  [LoanState.Committed]: "Repay needed",
  [LoanState.Repaying]: "Processing repayment",
  [LoanState.Settling]: "Finalizing settlement",
};
import { formatAmount, formatRelativeTime, formatUsd } from "../lib/format";
import { useDotPrice } from "../hooks/useDotPrice";
import { EmptyState } from "./EmptyState";
import { LoanCardSkeleton } from "./Skeleton";

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

/** Returns time health tier based on remaining seconds. */
function timeHealth(expiryAtSeconds: number): "safe" | "caution" | "danger" | "critical" | "none" {
  if (expiryAtSeconds <= 0) return "none";
  const now = Math.floor(Date.now() / 1000);
  const remaining = expiryAtSeconds - now;
  if (remaining <= 0) return "none";
  if (remaining <= 600) return "critical";   // ≤10 min
  if (remaining <= 1800) return "danger";    // ≤30 min
  if (remaining <= 3600) return "caution";   // ≤1 h
  return "safe";
}

const TIME_HEALTH_CLASSES = {
  safe: { bar: "bg-success", border: "", time: "text-success" },
  caution: { bar: "bg-warning", border: "", time: "text-warning" },
  danger: { bar: "bg-danger", border: "border-danger/40", time: "text-danger" },
  critical: { bar: "bg-danger animate-pulse", border: "border-danger/60", time: "text-danger font-bold" },
  none: { bar: "bg-ink/20 dark:bg-white/20", border: "", time: "" },
};

interface LoanCardProps {
  loan: LoanView;
  dotPrice: number | null;
}

function LoanCard({ loan, dotPrice }: LoanCardProps): JSX.Element {
  const meta = LOAN_STATE_META[loan.state];
  const progress = LOAN_PROGRESS[loan.state] ?? 0;
  const timeLeft = loan.expiryAt > 0 ? formatRelativeTime(loan.expiryAt) : "—";
  const bondUsd = formatUsd(loan.bondAmount, dotPrice);
  const tier = loan.expiryAt > 0 ? timeHealth(loan.expiryAt) : "none";
  const actionHint = LOAN_ACTION_HINT[loan.state];
  const health = TIME_HEALTH_CLASSES[tier];

  return (
    <Link
      href={`/loans/${loan.loanId}`}
      className={`group block rounded-2xl border bg-white/80 p-4 backdrop-blur transition hover:bg-white dark:bg-white/5 dark:hover:bg-white/8 ${
        health.border
          ? `${health.border} dark:${health.border}`
          : "border-ink/10 hover:border-primary/30 dark:border-white/10"
      }`}
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
        <div>
          <p className="font-mono text-sm text-ink/80 dark:text-white/75">
            {formatAmount(loan.bondAmount)} bonded
          </p>
          {bondUsd ? (
            <p className="text-xs text-ink/45 dark:text-white/35">{bondUsd}</p>
          ) : null}
        </div>
        <div className="text-right">
          <p className={`text-xs ${health.time || "text-ink/55 dark:text-white/45"}`}>
            {timeLeft}
          </p>
          {actionHint ? (
            <p className={`text-[10px] font-medium ${
              loan.state === LoanState.Committed
                ? "text-warning"
                : "text-ink/45 dark:text-white/35"
            }`}>
              {actionHint}
            </p>
          ) : null}
        </div>
      </div>

      {/* Workflow progress bar */}
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

      {/* Time health gauge */}
      {loan.expiryAt > 0 ? (
        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-ink/8 dark:bg-white/8">
          <div
            className={`h-full rounded-full transition-all duration-1000 ${health.bar}`}
            style={{
              width: `${Math.max(2, Math.min(100, ((loan.expiryAt - Math.floor(Date.now() / 1000)) / 7200) * 100))}%`,
            }}
            aria-label="Time remaining health"
          />
        </div>
      ) : null}
    </Link>
  );
}

export function ActiveLoansPage(): JSX.Element {
  const { account, isConnected } = useWallet();
  const myLoansQuery = useMyLoans(account);
  const dotPrice = useDotPrice();

  const activeLoans = useMemo(
    () => (myLoansQuery.data ?? []).filter((l) => isActive(l.state)),
    [myLoansQuery.data]
  );

  const handleRefresh = useCallback(async () => {
    await myLoansQuery.refetch();
  }, [myLoansQuery]);

  const { containerRef, pullDistance, refreshing } = usePullToRefresh({
    onRefresh: handleRefresh,
    threshold: 72,
  });

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
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <LoanCardSkeleton key={i} />
          ))}
        </div>
      </main>
    );
  }

  return (
    <main
      ref={containerRef as React.RefObject<HTMLElement>}
      className="mx-auto max-w-5xl px-4 py-8 md:px-6 animate-content-fade"
    >
      {/* Pull-to-refresh indicator */}
      {(pullDistance > 0 || refreshing) && (
        <div
          className="flex items-center justify-center overflow-hidden transition-all duration-200"
          style={{ height: Math.min(pullDistance, 72) }}
        >
          <RefreshCw
            size={20}
            className={`text-primary transition-transform ${refreshing ? "animate-spin" : ""}`}
            style={{ transform: `rotate(${Math.min(pullDistance, 72) * 3}deg)` }}
          />
        </div>
      )}
      <div className="hidden">{/* trick to avoid lint unused main */}</div>
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
            <LoanCard key={loan.loanId} loan={loan} dotPrice={dotPrice} />
          ))}
        </div>
      )}
    </main>

  );
}

