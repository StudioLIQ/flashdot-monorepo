"use client";

import { ExternalLink, Wallet } from "lucide-react";

import { ConfirmDialog } from "../ConfirmDialog";
import {
  formatDot,
  type CreateLoanState,
} from "../../hooks/useCreateLoan";
import { EXPLORER_TX_URL } from "../../lib/contracts";
import { useWallet } from "../../hooks/useWallet";

interface ReviewConfirmProps
  extends Pick<
    CreateLoanState,
    | "includeA"
    | "includeB"
    | "amountA"
    | "amountB"
    | "durationMinutes"
    | "preview"
    | "gasEstimate"
    | "gasEstimateUnable"
    | "canSubmit"
    | "submitting"
    | "message"
    | "error"
    | "createdLoanId"
    | "createdTxHash"
    | "submittedBondAmount"
    | "onSubmit"
  > {
  onBack: () => void;
  confirmOpen: boolean;
  onOpenConfirm: () => void;
  onCloseConfirm: () => void;
}

export function ReviewConfirm({
  includeA,
  includeB,
  amountA,
  amountB,
  durationMinutes,
  preview,
  gasEstimate,
  gasEstimateUnable,
  canSubmit,
  submitting,
  message,
  error,
  createdLoanId,
  createdTxHash,
  submittedBondAmount,
  onSubmit,
  onBack,
  confirmOpen,
  onOpenConfirm,
  onCloseConfirm,
}: ReviewConfirmProps): JSX.Element {
  const { isConnected, isCorrectNetwork } = useWallet();

  const durationLabel =
    Number(durationMinutes) >= 60
      ? `${(Number(durationMinutes) / 60).toFixed(Number(durationMinutes) % 60 === 0 ? 0 : 1)}h`
      : `${durationMinutes}m`;

  const gasLine =
    isConnected && isCorrectNetwork ? (
      <p className="font-mono text-xs text-ink/60 dark:text-white/55">
        {gasEstimateUnable
          ? "Est. Gas: Unable to estimate"
          : gasEstimate
            ? `Est. Gas: ~${gasEstimate}`
            : "Est. Gas: Calculating..."}
      </p>
    ) : null;

  return (
    <div className="mt-6 space-y-4">
      {/* Review summary */}
      <div className="rounded-xl border border-ink/15 bg-surface p-4 dark:border-white/10 dark:bg-surface-dark">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-ink/60 dark:text-white/55">
          Review Summary
        </p>
        <div className="grid gap-2 text-sm">
          {includeA ? (
            <div className="flex justify-between gap-2">
              <span className="text-ink/70 dark:text-white/65">Vault Alpha Amount</span>
              <span className="font-mono font-semibold">{amountA} DOT</span>
            </div>
          ) : null}
          {includeB ? (
            <div className="flex justify-between gap-2">
              <span className="text-ink/70 dark:text-white/65">Vault Beta Amount</span>
              <span className="font-mono font-semibold">{amountB} DOT</span>
            </div>
          ) : null}
          <div className="flex justify-between gap-2">
            <span className="text-ink/70 dark:text-white/65">Duration</span>
            <span className="font-semibold">{durationLabel}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-ink/70 dark:text-white/65">Legs</span>
            <span className="font-semibold">
              {[includeA && "Alpha", includeB && "Beta"].filter(Boolean).join(" + ")}{" "}
              ({[includeA, includeB].filter(Boolean).length})
            </span>
          </div>
          <div className="flex justify-between gap-2 border-t border-ink/10 pt-2 dark:border-white/10">
            <span className="font-semibold text-ink dark:text-white">Total Bond</span>
            <span className="font-mono font-bold">{formatDot(preview.totalBond)}</span>
          </div>
        </div>
      </div>

      {gasLine}

      {/* Submit */}
      <button
        type="button"
        onClick={onOpenConfirm}
        disabled={!canSubmit}
        aria-label="Create loan and lock bond"
        className={`inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition-all active:scale-[0.97] disabled:cursor-not-allowed disabled:bg-ink/20 disabled:text-ink/50 dark:disabled:bg-white/15 dark:disabled:text-white/35 sm:min-h-11 ${
          createdLoanId
            ? "animate-success-morph bg-primary text-primary-fg"
            : "bg-primary text-primary-fg hover:bg-primary-hover"
        }`}
      >
        {submitting ? (
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent dark:border-ink dark:border-t-transparent" />
        ) : null}
        {createdLoanId && !submitting
          ? "Created ✓"
          : submitting
            ? "Creating..."
            : "Create Loan & Lock Bond"}
      </button>

      {/* Wallet status */}
      <div className="space-y-1" aria-live="polite">
        {!isConnected ? (
          <p className="text-sm text-danger">Connect wallet first.</p>
        ) : null}
        {isConnected && !isCorrectNetwork ? (
          <p className="text-sm text-danger">Switch to Polkadot Hub EVM network.</p>
        ) : null}
      </div>

      {/* Submitting indicator */}
      {submitting ? (
        <div className="rounded-xl border border-ink/15 bg-ink/5 px-4 py-3 text-sm dark:border-white/10 dark:bg-white/5">
          <p className="inline-flex items-center gap-2 font-semibold">
            <Wallet size={16} className="shrink-0" />
            Waiting for confirmation in MetaMask...
          </p>
          <p className="mt-1 text-ink/70 dark:text-white/70">
            Review and approve the bond lock transaction in your wallet.
          </p>
        </div>
      ) : null}

      {/* Success */}
      {createdLoanId ? (
        <div className="animate-content-fade rounded-xl border border-success/45 bg-success/10 px-4 py-4 dark:border-success/40 dark:bg-success/20">
          <div className="inline-flex items-center gap-2">
            <span className="relative grid h-8 w-8 place-items-center rounded-full bg-success text-ink">
              <span className="absolute inset-0 rounded-full bg-success/45 animate-ping" />
              <span className="relative text-lg font-bold">✓</span>
            </span>
            <p className="text-lg font-bold text-ink dark:text-white">
              Loan #{createdLoanId} created!
            </p>
          </div>
          <p className="mt-2 text-sm text-ink/80 dark:text-white/80">
            Bond locked: {formatDot(submittedBondAmount ?? preview.totalBond)}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {createdTxHash ? (
              <a
                href={EXPLORER_TX_URL(createdTxHash)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-lg border border-ink/20 px-3 py-2 text-sm font-semibold hover:bg-ink/5 dark:border-white/15 dark:hover:bg-white/10"
              >
                View on Explorer <ExternalLink size={12} />
              </a>
            ) : null}
            {message ? (
              <p className="text-sm text-ink/75 dark:text-white/75">{message}</p>
            ) : null}
          </div>
        </div>
      ) : null}

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      {!createdLoanId ? (
        <button
          type="button"
          onClick={onBack}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-ink/20 px-5 py-2.5 text-sm font-semibold transition-all hover:bg-ink/5 active:scale-[0.97] dark:border-white/15 dark:hover:bg-white/10"
        >
          ← Back
        </button>
      ) : null}

      {/* Confirm dialog */}
      <ConfirmDialog
        open={confirmOpen}
        onClose={onCloseConfirm}
        title="Confirm Bond Lock"
        description="This sends an on-chain transaction and requires a wallet signature."
        confirmLabel="Confirm & Create"
        onConfirm={() => { void onSubmit(); }}
      >
        <div className="rounded-lg border border-ink/15 bg-ink/5 p-3 dark:border-white/10 dark:bg-white/5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-ink/60 dark:text-white/55">
            Transaction Summary
          </p>
          <div className="grid gap-1.5 text-sm">
            <div className="flex justify-between gap-2">
              <span className="text-ink/70 dark:text-white/65">Bond Amount</span>
              <span className="font-mono font-semibold">{formatDot(preview.totalBond)}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-ink/70 dark:text-white/65">Duration</span>
              <span className="font-semibold">{durationMinutes} min</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-ink/70 dark:text-white/65">Legs</span>
              <span className="font-semibold">
                {[includeA && "Alpha", includeB && "Beta"].filter(Boolean).join(" + ")}
              </span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-ink/70 dark:text-white/65">Est. Gas</span>
              <span className="font-mono font-semibold">
                {gasEstimateUnable
                  ? "Unable to estimate"
                  : gasEstimate
                    ? `~${gasEstimate}`
                    : "Calculating..."}
              </span>
            </div>
          </div>
        </div>
      </ConfirmDialog>
    </div>
  );
}
