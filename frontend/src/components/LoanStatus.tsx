"use client";

import { useMemo } from "react";

import type { LegView, LoanView } from "../lib/loan-types";
import { LoanState } from "../lib/loan-types";
import { LegTracker } from "./LegTracker";
import { RepayOnlyBanner } from "./RepayOnlyBanner";

interface LoanStatusProps {
  loan: LoanView | null;
  legs: LegView[];
  refreshing?: boolean;
  onRepaid?: () => void;
}

const LOAN_STATE_LABEL: Record<number, string> = {
  [LoanState.Created]: "Created",
  [LoanState.Preparing]: "Preparing",
  [LoanState.Prepared]: "Prepared",
  [LoanState.Committing]: "Committing",
  [LoanState.Committed]: "Committed",
  [LoanState.Repaying]: "Repaying",
  [LoanState.Settling]: "Settling",
  [LoanState.Settled]: "Settled",
  [LoanState.Aborted]: "Aborted",
  [LoanState.Defaulted]: "Defaulted",
};

function formatDot(amount: bigint): string {
  return `${(Number(amount) / 1e18).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  })} DOT`;
}

export function LoanStatus({ loan, legs, refreshing, onRepaid }: LoanStatusProps): JSX.Element {
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

  if (!loan) {
    return (
      <section className="mt-8 rounded-2xl border border-ink/15 bg-white p-6">
        <h2 className="text-xl font-semibold">Loan Status</h2>
        <p className="mt-2 text-sm text-ink/70">No active loan selected.</p>
      </section>
    );
  }

  return (
    <section className="mt-8 rounded-2xl border border-ink/15 bg-white p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Loan #{loan.loanId}</h2>
        <p className="text-sm text-ink/70">
          {LOAN_STATE_LABEL[loan.state] ?? `State ${loan.state}`}
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
        <p className="mt-5 rounded-lg border border-ink/15 bg-mint p-3 text-sm font-semibold text-ink">
          {terminalMessage}
        </p>
      ) : null}
    </section>
  );
}
