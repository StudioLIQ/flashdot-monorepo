"use client";

import { useMemo } from "react";

import type { LegView, LoanView } from "../lib/loan-types";
import { LOAN_STATE_META, LoanState } from "../lib/loan-types";
import { LegTracker } from "./LegTracker";
import { RepayOnlyBanner } from "./RepayOnlyBanner";

interface LoanStatusProps {
  loan: LoanView | null;
  legs: LegView[];
  refreshing?: boolean;
  loading?: boolean;
  onRepaid?: () => void;
}

function formatDot(amount: bigint): string {
  return `${(Number(amount) / 1e18).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  })} DOT`;
}

export function LoanStatus({ loan, legs, refreshing, loading, onRepaid }: LoanStatusProps): JSX.Element {
  const stateMeta = loan ? LOAN_STATE_META[loan.state] : null;

  const terminalMessage = useMemo(() => {
    if (!loan) return null;
    if (loan.state === LoanState.Settled) {
      return `Bond Returned: ${formatDot(loan.bondAmount)}`;
    }
    if (loan.state === LoanState.Defaulted) {
      return `Slashed Amount: ${formatDot(loan.slashedAmount)}`;
    }
    return null;
  }, [loan]);

  if (loading) {
    return (
      <section className="mt-8 rounded-2xl border border-ink/15 bg-white p-6 dark:border-white/10 dark:bg-white/5">
        <div className="flex items-center justify-between gap-3">
          <div className="h-7 w-32 animate-pulse rounded-lg bg-ink/10 dark:bg-white/10" />
          <div className="h-5 w-24 animate-pulse rounded-lg bg-ink/10 dark:bg-white/10" />
        </div>

        <div className="mt-5 grid gap-3">
          {Array.from({ length: 2 }).map((_, index) => (
            <div
              key={index}
              className="rounded-xl border border-ink/10 bg-ink/5 p-4 dark:border-white/10 dark:bg-white/5"
            >
              <div className="h-5 w-40 animate-pulse rounded bg-ink/10 dark:bg-white/10" />
              <div className="mt-3 grid gap-2 sm:grid-cols-5">
                {Array.from({ length: 5 }).map((__, stepIndex) => (
                  <div
                    key={stepIndex}
                    className="h-10 animate-pulse rounded-lg bg-ink/10 dark:bg-white/10"
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (!loan) {
    return (
      <section className="mt-8 rounded-2xl border border-ink/15 bg-white p-6 dark:border-white/10 dark:bg-white/5">
        <h2 className="text-xl font-semibold">Loan Status</h2>
        <p className="mt-2 text-sm text-ink/70 dark:text-white/65">No active loan selected.</p>
      </section>
    );
  }

  return (
    <section className="mt-8 rounded-2xl border border-ink/15 bg-white p-6 dark:border-white/10 dark:bg-white/5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Loan #{loan.loanId}</h2>
        <p className="text-sm text-ink/70 dark:text-white/65">
          {stateMeta ? `${stateMeta.icon} ${stateMeta.label}` : `State ${loan.state}`}
          {refreshing ? " · updating..." : ""}
        </p>
      </div>

      {loan.repayOnlyMode ? <div className="mt-4"><RepayOnlyBanner /></div> : null}

      <div className="mt-5 grid gap-3">
        {legs.map((leg) => (
          <LegTracker
            key={`${leg.loanId}-${leg.legId}`}
            leg={leg}
            {...(onRepaid ? { onRepaid } : {})}
          />
        ))}
      </div>

      {terminalMessage ? (
        <p className="mt-5 rounded-lg border border-ink/15 bg-mint p-3 text-sm font-semibold text-ink dark:border-white/10 dark:bg-emerald-950/50 dark:text-white">
          {terminalMessage}
        </p>
      ) : null}
    </section>
  );
}
