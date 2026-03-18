"use client";

import {
  Activity,
  CheckCircle2,
  Clock,
  PlusCircle,
  TrendingUp,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

import { useLoanHistory } from "../hooks/useLoanHistory";
import { useMyLoans } from "../hooks/useMyLoans";
import { useDotPrice } from "../hooks/useDotPrice";
import { LOAN_STATE_META, LoanState, type LoanView } from "../lib/loan-types";
import { formatAmount, formatUsd, formatRelativeTime } from "../lib/format";
import { KpiCardSkeleton, LoanCardSkeleton } from "./Skeleton";

interface DashboardViewProps {
  account: string;
}

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

function isTerminal(state: number): boolean {
  return (
    state === LoanState.Settled ||
    state === LoanState.Defaulted ||
    state === LoanState.Aborted
  );
}

interface KpiCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  accent?: "primary" | "success" | "warning" | "info";
}

function KpiCard({ icon, label, value, sub, accent = "primary" }: KpiCardProps): JSX.Element {
  const accentMap = {
    primary: "text-primary",
    success: "text-success",
    warning: "text-warning",
    info: "text-info",
  };
  return (
    <div className="elevation-1 elevation-hover-lift rounded-2xl p-4">
      <div className="flex items-center gap-2.5">
        <div className={`${accentMap[accent]} shrink-0`}>{icon}</div>
        <p className="text-xs font-semibold uppercase tracking-[0.07em] text-ink/55 dark:text-white/50">
          {label}
        </p>
      </div>
      <p className="type-h2 mt-2 font-mono text-ink dark:text-white">{value}</p>
      {sub ? (
        <p className="mt-0.5 text-xs text-ink/55 dark:text-white/45">{sub}</p>
      ) : null}
    </div>
  );
}

interface ActiveLoanRowProps {
  loan: LoanView;
}

function ActiveLoanRow({ loan }: ActiveLoanRowProps): JSX.Element {
  const progress = LOAN_PROGRESS[loan.state] ?? 0;
  const meta = LOAN_STATE_META[loan.state];
  const timeLeft = loan.expiryAt > 0 ? formatRelativeTime(loan.expiryAt) : "-";

  return (
    <Link
      href={`/loans/${loan.loanId}`}
      className="flex items-center gap-3 rounded-xl border border-ink/10 bg-white/60 px-4 py-3 transition hover:bg-white/90 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/8"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="font-mono text-sm font-semibold">Loan #{loan.loanId}</p>
          <span className="shrink-0 text-xs text-ink/55 dark:text-white/45">{timeLeft}</span>
        </div>
        <p className="mt-0.5 text-xs text-ink/60 dark:text-white/55">
          {meta?.label ?? "Processing"} · {formatAmount(loan.bondAmount)} bonded
        </p>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink/10 dark:bg-white/10">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
      <Activity size={16} className="shrink-0 text-ink/35 dark:text-white/30" />
    </Link>
  );
}

export function DashboardView({ account }: DashboardViewProps): JSX.Element {
  const myLoansQuery = useMyLoans(account);
  const historyQuery = useLoanHistory(account);
  const dotPrice = useDotPrice();

  const allLoans = myLoansQuery.data ?? [];
  const historyLoans = historyQuery.data ?? [];

  const activeLoans = useMemo(
    () => allLoans.filter((l) => !isTerminal(l.state)),
    [allLoans]
  );

  const settledLoans = useMemo(
    () => historyLoans.filter((l) => l.state === LoanState.Settled),
    [historyLoans]
  );

  const defaultedLoans = useMemo(
    () => historyLoans.filter((l) => l.state === LoanState.Defaulted),
    [historyLoans]
  );

  const totalLockedBond = useMemo(
    () => activeLoans.reduce((sum, l) => sum + l.bondAmount, 0n),
    [activeLoans]
  );

  const totalRepaid = useMemo(
    () => settledLoans.reduce((sum, l) => sum + l.bondAmount, 0n),
    [settledLoans]
  );

  const successRate = useMemo(() => {
    const total = settledLoans.length + defaultedLoans.length;
    if (total === 0) return null;
    return Math.round((settledLoans.length / total) * 100);
  }, [settledLoans, defaultedLoans]);

  const isLoading = myLoansQuery.isLoading || historyQuery.isLoading;

  if (isLoading) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-8 md:px-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <KpiCardSkeleton key={i} />
          ))}
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 md:px-6 animate-content-fade">
      {/* KPI Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={<Zap size={18} />}
          label="Locked Bond"
          value={formatAmount(totalLockedBond)}
          sub={[
            formatUsd(totalLockedBond, dotPrice),
            activeLoans.length > 0
              ? `across ${activeLoans.length} loan${activeLoans.length > 1 ? "s" : ""}`
              : "No active loans",
          ].filter(Boolean).join(" · ")}
          accent="primary"
        />
        <KpiCard
          icon={<Activity size={18} />}
          label="Active Loans"
          value={String(activeLoans.length)}
          sub={activeLoans.length > 0 ? "In progress" : "All clear"}
          accent="info"
        />
        <KpiCard
          icon={<CheckCircle2 size={18} />}
          label="Total Repaid"
          value={settledLoans.length > 0 ? formatAmount(totalRepaid) : "—"}
          sub={[
            settledLoans.length > 0 ? formatUsd(totalRepaid, dotPrice) : null,
            settledLoans.length > 0
              ? `${settledLoans.length} settled loan${settledLoans.length > 1 ? "s" : ""}`
              : "No settled loans yet",
          ].filter(Boolean).join(" · ")}
          accent="success"
        />
        <KpiCard
          icon={<TrendingUp size={18} />}
          label="Success Rate"
          value={successRate !== null ? `${successRate}%` : "—"}
          sub={
            settledLoans.length + defaultedLoans.length > 0
              ? `${settledLoans.length} settled / ${defaultedLoans.length} defaulted`
              : "No closed loans yet"
          }
          accent="warning"
        />
      </div>

      {/* Active loans mini list */}
      {activeLoans.length > 0 ? (
        <div className="mt-6">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-[0.07em] text-ink/55 dark:text-white/50">
              Active Loans
            </h2>
            <Link
              href="/loans"
              className="text-xs font-semibold text-primary hover:underline"
            >
              View all →
            </Link>
          </div>
          <div className="space-y-2">
            {activeLoans.slice(0, 3).map((loan) => (
              <ActiveLoanRow key={loan.loanId} loan={loan} />
            ))}
          </div>
        </div>
      ) : null}

      {/* Quick actions */}
      <div className="mt-8 flex flex-wrap items-center gap-3">
        <Link
          href="/create"
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-fg transition hover:bg-primary-hover"
        >
          <PlusCircle size={16} />
          New Loan
        </Link>
        {historyLoans.length > 0 ? (
          <Link
            href="/history"
            className="inline-flex items-center gap-2 rounded-xl border border-ink/15 px-5 py-2.5 text-sm font-semibold transition hover:bg-ink/5 dark:border-white/15 dark:hover:bg-white/8"
          >
            <Clock size={16} />
            View History
          </Link>
        ) : null}
      </div>
    </main>
  );
}
