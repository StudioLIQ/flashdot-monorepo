"use client";

import { formatEther } from "ethers";
import { useMemo, useState } from "react";

import { useLoan } from "../hooks/useLoan";
import { LOAN_STATE_META, LoanState, type LoanView } from "../lib/loan-types";

interface LoanHistoryProps {
  loans: LoanView[];
  loading?: boolean;
}

interface HistoryRowProps {
  loan: LoanView;
  expanded: boolean;
  onToggle: () => void;
}

function formatDot(value: bigint): string {
  return `${Number(formatEther(value)).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  })} DOT`;
}

function statusTone(state: number): string {
  if (state === LoanState.Settled) return "bg-success/20 text-ink dark:text-white";
  if (state === LoanState.Defaulted) return "bg-danger/20 text-danger";
  return "bg-info/20 text-ink dark:text-white";
}

function formatRelative(seconds: number): string {
  const now = Math.floor(Date.now() / 1000);
  const delta = seconds - now;
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

  if (Math.abs(delta) < 60) return rtf.format(Math.round(delta), "second");
  if (Math.abs(delta) < 3_600) return rtf.format(Math.round(delta / 60), "minute");
  if (Math.abs(delta) < 86_400) return rtf.format(Math.round(delta / 3_600), "hour");
  return rtf.format(Math.round(delta / 86_400), "day");
}

function bondOutcome(loan: LoanView): string {
  if (loan.state === LoanState.Settled) return `Returned ${formatDot(loan.bondAmount)}`;
  if (loan.state === LoanState.Defaulted) return "Slashed by protocol";
  if (loan.state === LoanState.Aborted) return "Returned minus fees";
  return "-";
}

function HistoryRow({ loan, expanded, onToggle }: HistoryRowProps): JSX.Element {
  const loanQuery = useLoan(loan.loanId);
  const legs = loanQuery.data?.legs ?? [];

  return (
    <div className="rounded-xl border border-ink/10 bg-white/60 dark:border-white/10 dark:bg-white/5">
      <button
        type="button"
        onClick={onToggle}
        className="grid w-full grid-cols-[auto_1fr] gap-3 px-4 py-3 text-left sm:grid-cols-[80px_1fr_150px_1fr_110px]"
      >
        <p className="text-sm font-semibold">#{loan.loanId}</p>
        <p className="text-sm text-ink/80 dark:text-white/80">{formatDot(loan.bondAmount)}</p>
        <p className="sm:justify-self-start">
          <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${statusTone(loan.state)}`}>
            {LOAN_STATE_META[loan.state]?.label ?? "Unknown"}
          </span>
        </p>
        <p className="text-sm text-ink/80 dark:text-white/80">{bondOutcome(loan)}</p>
        <p className="text-sm text-ink/70 dark:text-white/70">{formatRelative(loan.expiryAt)}</p>
      </button>

      {expanded ? (
        <div className="border-t border-ink/10 px-4 py-3 text-sm dark:border-white/10">
          {loanQuery.isLoading ? (
            <p className="text-ink/70 dark:text-white/70">Loading leg details...</p>
          ) : legs.length === 0 ? (
            <p className="text-ink/70 dark:text-white/70">No leg details available.</p>
          ) : (
            <div className="grid gap-2">
              {legs.map((leg) => (
                <div
                  key={`${leg.loanId}-${leg.legId}`}
                  className="rounded-lg border border-ink/10 bg-ink/5 px-3 py-2 text-xs dark:border-white/10 dark:bg-white/5"
                >
                  Leg #{leg.legId} · {formatDot(leg.amount)} · Repay {formatDot(leg.repayAmount)}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

export function LoanHistory({ loans, loading }: LoanHistoryProps): JSX.Element {
  const [showAll, setShowAll] = useState(false);
  const [expandedLoanId, setExpandedLoanId] = useState<string | null>(null);

  const visibleLoans = useMemo(() => (showAll ? loans : loans.slice(0, 5)), [loans, showAll]);

  if (loading) {
    return (
      <section className="mt-6 rounded-2xl border border-ink/15 bg-white p-5 dark:border-white/10 dark:bg-white/5">
        <p className="text-sm font-semibold">History</p>
        <div className="mt-3 space-y-2">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-12 animate-pulse rounded-lg bg-ink/10 dark:bg-white/10" />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="mt-6 rounded-2xl border border-ink/15 bg-white p-5 dark:border-white/10 dark:bg-white/5">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-[0.1em]">History</h3>
          <p className="mt-1 text-xs text-ink/70 dark:text-white/70">
            Settled, defaulted, and aborted loans.
          </p>
        </div>
        {loans.length > 5 ? (
          <button
            type="button"
            onClick={() => setShowAll((value) => !value)}
            className="rounded-lg border border-ink/20 px-3 py-1.5 text-xs font-semibold hover:bg-ink/5 dark:border-white/15 dark:hover:bg-white/10"
          >
            {showAll ? "Show recent 5" : "Show all"}
          </button>
        ) : null}
      </div>

      {visibleLoans.length === 0 ? (
        <p className="mt-4 rounded-lg border border-ink/10 bg-ink/5 px-3 py-3 text-sm text-ink/70 dark:border-white/10 dark:bg-white/5 dark:text-white/70">
          No completed loans yet.
        </p>
      ) : (
        <div className="mt-4 grid gap-2">
          {visibleLoans.map((loan) => (
            <HistoryRow
              key={loan.loanId}
              loan={loan}
              expanded={expandedLoanId === loan.loanId}
              onToggle={() => {
                setExpandedLoanId((value) => (value === loan.loanId ? null : loan.loanId));
              }}
            />
          ))}
        </div>
      )}
    </section>
  );
}
