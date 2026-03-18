"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { EXPLORER_TX_URL, getHubContract } from "../lib/contracts";
import type { LegView, LoanView } from "../lib/loan-types";
import { LegState, LOAN_STATE_META, LoanState } from "../lib/loan-types";
import { useToast } from "../providers/ToastProvider";
import { ConfirmDialog } from "./ConfirmDialog";
import { LegTracker } from "./LegTracker";
import { RepayOnlyBanner } from "./RepayOnlyBanner";
import { Skeleton } from "./Skeleton";

interface LoanStatusProps {
  loan: LoanView | null;
  legs: LegView[];
  refreshing?: boolean;
  loading?: boolean;
  onRepaid?: () => void;
}

interface EthereumWindow extends Window {
  ethereum?: unknown;
}

const LOAN_PROGRESS_PERCENT: Record<number, number> = {
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

function formatDot(amount: bigint): string {
  return `${(Number(amount) / 1e18).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  })} DOT`;
}

export function LoanStatus({ loan, legs, refreshing, loading, onRepaid }: LoanStatusProps): JSX.Element {
  const { showToast } = useToast();
  const previousStateRef = useRef<{ loanId: string; state: number } | null>(null);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [cancelPending, setCancelPending] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [stateJustChanged, setStateJustChanged] = useState(false);
  const stateMeta = loan ? LOAN_STATE_META[loan.state] : null;
  const progressPercent = loan ? LOAN_PROGRESS_PERCENT[loan.state] ?? 0 : 0;
  const committedLegCount = useMemo(
    () => legs.filter((leg) => leg.state >= LegState.CommittedAcked).length,
    [legs]
  );
  const canCancel = Boolean(
    loan &&
      (loan.state === LoanState.Created || loan.state === LoanState.Preparing || loan.state === LoanState.Prepared)
  );

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

  useEffect(() => {
    if (!loan) {
      previousStateRef.current = null;
      return;
    }

    const previous = previousStateRef.current;
    if (previous && previous.loanId === loan.loanId && previous.state !== loan.state) {
      const label = LOAN_STATE_META[loan.state]?.label ?? `State ${loan.state}`;
      showToast({
        tone: "info",
        title: `Loan #${loan.loanId} status update`,
        description: label,
      });
      // Trigger visual flash animation
      setStateJustChanged(true);
      setTimeout(() => setStateJustChanged(false), 1500);
    }

    previousStateRef.current = { loanId: loan.loanId, state: loan.state };
  }, [loan, showToast]);

  const cancelLoan = async (): Promise<void> => {
    if (!loan || !canCancel) return;

    const ethereum = (window as EthereumWindow).ethereum;
    setCancelPending(true);
    setCancelError(null);

    try {
      const hub = await getHubContract(ethereum);
      const tx = await hub.cancelBeforeCommit(BigInt(loan.loanId));
      const receipt = await tx.wait();
      const txHash = (receipt as { hash?: string }).hash ?? null;
      setCancelConfirmOpen(false);
      showToast({
        tone: "success",
        title: `Loan #${loan.loanId} cancelled`,
        description: "Bond return is now in progress.",
        ...(txHash ? { link: { href: EXPLORER_TX_URL(txHash), label: "View on Explorer" } } : {}),
      });
      onRepaid?.();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setCancelError(message);
      showToast({
        tone: "error",
        title: `Cancel failed for loan #${loan.loanId}`,
        description: message,
      });
    } finally {
      setCancelPending(false);
    }
  };

  if (loading) {
    return (
      <section className="mt-8 rounded-2xl border border-ink/15 bg-white p-6 dark:border-white/10 dark:bg-white/5" aria-labelledby="loan-status-loading-title">
        <h2 id="loan-status-loading-title" className="sr-only">Loan status loading</h2>
        <div className="flex items-center justify-between gap-3">
          <Skeleton width={128} height={28} />
          <Skeleton width={96} height={20} />
        </div>

        <div className="mt-5 grid gap-3">
          {Array.from({ length: 2 }).map((_, index) => (
            <div
              key={index}
              className="rounded-xl border border-ink/10 bg-ink/5 p-4 dark:border-white/10 dark:bg-white/5"
            >
              <Skeleton width={160} height={20} />
              <div className="mt-3 grid gap-2 sm:grid-cols-5">
                {Array.from({ length: 5 }).map((__, stepIndex) => (
                  <Skeleton key={stepIndex} height={40} />
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
      <section className="mt-8 rounded-2xl border border-ink/15 bg-white p-6 dark:border-white/10 dark:bg-white/5" aria-labelledby="loan-status-empty-title">
        <div className="flex flex-col items-center gap-4 py-6 text-center">
          {/* Empty state illustration — dashboard with lightning */}
          <svg width="100" height="100" viewBox="0 0 100 100" fill="none" aria-hidden="true" className="opacity-65">
            <rect x="10" y="20" width="80" height="55" rx="6" stroke="#42db8d" strokeWidth="2.5" fill="none" />
            <rect x="18" y="30" width="20" height="14" rx="2" fill="#42db8d" fillOpacity="0.25" stroke="#42db8d" strokeWidth="1.5" />
            <rect x="44" y="30" width="20" height="14" rx="2" fill="#42db8d" fillOpacity="0.15" stroke="#42db8d" strokeWidth="1.5" />
            <rect x="18" y="50" width="46" height="6" rx="2" fill="#42db8d" fillOpacity="0.15" />
            <rect x="18" y="61" width="32" height="6" rx="2" fill="#42db8d" fillOpacity="0.10" />
            <polygon points="72,28 65,45 71,45 64,62 76,42 70,42" fill="#f5ad32" opacity="0.9" />
          </svg>
          <div>
            <h2 id="loan-status-empty-title" className="text-lg font-semibold">No active loans</h2>
            <p className="mt-1.5 max-w-xs text-sm text-ink/70 dark:text-white/65">
              Create a bonded flash loan to get started. One signature locks the bond and starts execution.
            </p>
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-ink/10 bg-white/70 p-3 dark:border-white/10 dark:bg-white/5">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink/60 dark:text-white/60">Step 1</p>
            <p className="mt-1 text-sm font-semibold">Select vaults</p>
            <p className="mt-1 text-xs text-ink/70 dark:text-white/70">Choose where to borrow and set leg amounts.</p>
          </div>
          <div className="rounded-xl border border-ink/10 bg-white/70 p-3 dark:border-white/10 dark:bg-white/5">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink/60 dark:text-white/60">Step 2</p>
            <p className="mt-1 text-sm font-semibold">Set duration</p>
            <p className="mt-1 text-xs text-ink/70 dark:text-white/70">Define expiry and review the required bond.</p>
          </div>
          <div className="rounded-xl border border-ink/10 bg-white/70 p-3 dark:border-white/10 dark:bg-white/5">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink/60 dark:text-white/60">Step 3</p>
            <p className="mt-1 text-sm font-semibold">Sign once</p>
            <p className="mt-1 text-xs text-ink/70 dark:text-white/70">One signature locks bond and starts execution.</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="elevation-1 mt-8 rounded-2xl p-6" aria-labelledby="loan-status-title">
      <div className="flex items-center justify-between gap-3">
        <h2 id="loan-status-title" className="font-mono text-xl font-semibold">Loan #{loan.loanId}</h2>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <p
            className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm text-ink/70 dark:text-white/65 ${stateJustChanged ? "animate-badge-flash" : ""}`}
            aria-live="polite"
            key={loan.state}
          >
            {stateMeta ? <><stateMeta.icon size={14} className="shrink-0" />{stateMeta.label}</> : `State ${loan.state}`}
            {refreshing ? " · updating..." : ""}
          </p>
          {canCancel ? (
            <button
              type="button"
              onClick={() => setCancelConfirmOpen(true)}
              className="min-h-11 rounded-lg border border-danger/45 px-3 py-2 text-xs font-semibold text-danger hover:bg-danger/10 dark:border-danger/40 dark:text-danger dark:hover:bg-danger/20"
            >
              Cancel Loan
            </button>
          ) : null}
        </div>
      </div>
      <div className="mt-4">
        <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.08em] text-ink/65 dark:text-white/65">
          <span>Overall Progress</span>
          <span>{progressPercent}%</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-ink/15 dark:bg-white/10">
          <div
            className={`h-full rounded-full bg-success transition-[width] duration-500 ease-out ${stateJustChanged ? "animate-progress-glow" : ""}`}
            style={{ width: `${progressPercent}%` }}
            role="progressbar"
            aria-valuenow={progressPercent}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>
      </div>

      {loan.repayOnlyMode ? (
        <div className="mt-4">
          <RepayOnlyBanner
            committedLegs={committedLegCount}
            totalLegs={legs.length}
            expiryAt={loan.expiryAt}
          />
        </div>
      ) : null}

      <div className="animate-content-fade mt-5 grid gap-3">
        {legs.map((leg) => (
          <LegTracker
            key={`${leg.loanId}-${leg.legId}`}
            leg={leg}
            {...(onRepaid ? { onRepaid } : {})}
          />
        ))}
      </div>

      {terminalMessage ? (
        <p className="mt-5 rounded-lg border border-success/40 bg-success/10 p-3 text-sm font-semibold text-ink dark:border-success/35 dark:bg-success/20 dark:text-white">
          {terminalMessage}
        </p>
      ) : null}
      {cancelError ? (
        <p role="alert" className="mt-3 text-xs text-danger">{cancelError}</p>
      ) : null}

      <ConfirmDialog
        open={cancelConfirmOpen}
        onClose={() => setCancelConfirmOpen(false)}
        title={`Cancel loan #${loan.loanId}?`}
        description="Your bond will be returned minus fees after cancellation is finalized."
        cancelLabel="Keep Loan"
        confirmLabel="Confirm Cancel"
        confirmTone="destructive"
        onConfirm={() => void cancelLoan()}
        loading={cancelPending}
      />
    </section>
  );
}
