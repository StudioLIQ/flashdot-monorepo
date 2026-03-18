"use client";

import { formatEther } from "ethers";
import { useMemo, useState } from "react";

import { useLoan } from "../hooks/useLoan";
import { LOAN_STATE_META, LoanState, type LoanView } from "../lib/loan-types";
import { Skeleton } from "./Skeleton";

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
    <div className="elevation-0 rounded-xl">
      <button
        type="button"
        onClick={onToggle}
        className="w-full px-4 py-3 text-left"
      >
        {/* Mobile card layout */}
        <div className="flex items-center justify-between gap-3 sm:hidden">
          <div>
            <p className="font-mono text-sm font-semibold">Loan #{loan.loanId}</p>
            <p className="mt-0.5 font-mono text-xs text-ink/70 dark:text-white/65">{formatDot(loan.bondAmount)}</p>
          </div>
          <div className="text-right">
            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${statusTone(loan.state)}`}>
              {LOAN_STATE_META[loan.state]?.label ?? "Unknown"}
            </span>
            <p className="mt-0.5 text-xs text-ink/60 dark:text-white/55">{formatRelative(loan.expiryAt)}</p>
          </div>
        </div>
        {/* Desktop table row */}
        <div className="hidden grid-cols-[80px_1fr_150px_1fr_110px] gap-3 sm:grid">
          <p className="font-mono text-sm font-semibold">#{loan.loanId}</p>
          <p className="font-mono text-sm text-ink/80 dark:text-white/80">{formatDot(loan.bondAmount)}</p>
          <p>
            <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${statusTone(loan.state)}`}>
              {LOAN_STATE_META[loan.state]?.label ?? "Unknown"}
            </span>
          </p>
          <p className="text-sm text-ink/80 dark:text-white/80">{bondOutcome(loan)}</p>
          <p className="text-sm text-ink/70 dark:text-white/70">{formatRelative(loan.expiryAt)}</p>
        </div>
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
            <Skeleton key={index} height={48} />
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
        <div className="mt-6 flex flex-col items-center gap-4 py-8 text-center">
          {/* Empty state illustration — clock + document */}
          <svg width="80" height="80" viewBox="0 0 80 80" fill="none" aria-hidden="true" className="opacity-60">
            <circle cx="36" cy="36" r="24" stroke="#42db8d" strokeWidth="2.5" fill="none" />
            <circle cx="36" cy="36" r="2.5" fill="#42db8d" />
            <line x1="36" y1="36" x2="36" y2="22" stroke="#42db8d" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="36" y1="36" x2="46" y2="36" stroke="#f5ad32" strokeWidth="2.5" strokeLinecap="round" />
            <rect x="50" y="42" width="22" height="28" rx="3" stroke="#42db8d" strokeWidth="2" fill="none" />
            <line x1="55" y1="51" x2="67" y2="51" stroke="#42db8d" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
            <line x1="55" y1="56" x2="67" y2="56" stroke="#42db8d" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
            <line x1="55" y1="61" x2="62" y2="61" stroke="#f5ad32" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
          </svg>
          <div>
            <p className="text-sm font-semibold">No completed loans yet</p>
            <p className="mt-1 text-xs text-ink/60 dark:text-white/55">Settled, defaulted, and aborted loans will appear here.</p>
          </div>
        </div>
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
