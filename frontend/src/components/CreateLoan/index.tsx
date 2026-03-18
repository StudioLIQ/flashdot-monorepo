"use client";

import { ExternalLink, Wallet } from "lucide-react";
import { useState } from "react";

import { useCreateLoan, formatDot } from "../../hooks/useCreateLoan";
import { useWallet } from "../../hooks/useWallet";
import { useWalletModal } from "../../providers/WalletModalProvider";
import { EXPLORER_TX_URL } from "../../lib/contracts";
import { ConfirmDialog } from "../ConfirmDialog";
import { LoanTerms } from "./LoanTerms";

export function CreateLoan(): JSX.Element {
  const state = useCreateLoan();
  const { isConnected, isCorrectNetwork } = useWallet();
  const walletModal = useWalletModal();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const durationLabel =
    Number(state.durationMinutes) >= 60
      ? `${(Number(state.durationMinutes) / 60).toFixed(Number(state.durationMinutes) % 60 === 0 ? 0 : 1)}h`
      : `${state.durationMinutes}m`;

  return (
    <section
      className="elevation-1 rounded-none p-4 sm:rounded-2xl sm:p-6"
      aria-labelledby="create-loan-title"
    >
      {/* Header */}
      <div className="mb-5">
        <h2 id="create-loan-title" className="text-xl font-semibold">
          Create Flash Loan
        </h2>
        <p className="mt-0.5 text-sm text-ink/70 dark:text-white/65">
          Select vaults, set amounts and duration, then confirm with one signature.
        </p>
      </div>

      {/* Vault selectors + amount inputs + duration */}
      <LoanTerms
        includeA={state.includeA}
        includeB={state.includeB}
        amountA={state.amountA}
        amountB={state.amountB}
        amountABigint={state.amountABigint}
        amountBBigint={state.amountBBigint}
        isInvalidA={state.isInvalidA}
        isInvalidB={state.isInvalidB}
        durationMinutes={state.durationMinutes}
        setIncludeA={state.setIncludeA}
        setIncludeB={state.setIncludeB}
        setAmountA={state.setAmountA}
        setAmountB={state.setAmountB}
        setDurationMinutes={state.setDurationMinutes}
        preview={state.preview}
        canProceedToStep3={state.canProceedToStep3}
        isGuided={false}
        onBack={() => {}}
        onNext={() => {}}
      />

      {/* Gas estimate */}
      {isConnected && isCorrectNetwork ? (
        <p className="mt-3 font-mono text-xs text-ink/55 dark:text-white/45">
          {state.gasEstimateUnable
            ? "Est. Gas: Unable to estimate"
            : state.gasEstimate
              ? `Est. Gas: ~${state.gasEstimate}`
              : "Est. Gas: Calculating..."}
        </p>
      ) : null}

      {/* Wallet status */}
      <div className="mt-3 space-y-1" aria-live="polite">
        {!isConnected ? (
          <button
            type="button"
            onClick={walletModal.open}
            className="text-sm font-semibold text-primary hover:underline"
          >
            Connect wallet to create a loan →
          </button>
        ) : isConnected && !isCorrectNetwork ? (
          <p className="text-sm text-danger">
            Switch to Polkadot Hub EVM network to continue.
          </p>
        ) : null}
      </div>

      {/* Primary CTA */}
      <button
        type="button"
        onClick={() => setConfirmOpen(true)}
        disabled={!state.canSubmit}
        aria-label="Create loan and lock bond"
        className={`mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition-all active:scale-[0.97] disabled:cursor-not-allowed disabled:bg-ink/20 disabled:text-ink/50 dark:disabled:bg-white/15 dark:disabled:text-white/35 sm:min-h-11 ${
          state.createdLoanId
            ? "animate-success-morph bg-primary text-primary-fg"
            : "bg-primary text-primary-fg hover:bg-primary-hover"
        }`}
      >
        {state.submitting ? (
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent dark:border-ink dark:border-t-transparent" />
        ) : null}
        {state.createdLoanId && !state.submitting
          ? "Created ✓"
          : state.submitting
            ? "Creating..."
            : "Create Loan & Lock Bond"}
      </button>

      {/* Submitting indicator */}
      {state.submitting ? (
        <div className="mt-3 rounded-xl border border-ink/15 bg-ink/5 px-4 py-3 text-sm dark:border-white/10 dark:bg-white/5">
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
      {state.createdLoanId ? (
        <div className="mt-3 animate-bounce-in rounded-xl border border-success/45 bg-success/10 px-4 py-4 dark:border-success/40 dark:bg-success/20">
          <div className="inline-flex items-center gap-2">
            <span className="relative grid h-8 w-8 place-items-center rounded-full bg-success text-ink">
              <span className="absolute inset-0 rounded-full bg-success/45 animate-ping" />
              <span className="relative text-lg font-bold">✓</span>
            </span>
            <p className="text-lg font-bold text-ink dark:text-white">
              Loan #{state.createdLoanId} created!
            </p>
          </div>
          <p className="mt-2 text-sm text-ink/80 dark:text-white/80">
            Bond locked: {formatDot(state.submittedBondAmount ?? state.preview.totalBond)}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {state.createdTxHash ? (
              <a
                href={EXPLORER_TX_URL(state.createdTxHash)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-lg border border-ink/20 px-3 py-2 text-sm font-semibold hover:bg-ink/5 dark:border-white/15 dark:hover:bg-white/10"
              >
                View on Explorer <ExternalLink size={12} />
              </a>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Error */}
      {state.error ? (
        <p className="mt-3 text-sm text-danger">{state.error}</p>
      ) : null}

      {/* Confirm dialog */}
      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Confirm Bond Lock"
        description="This sends an on-chain transaction and requires a wallet signature."
        confirmLabel="Confirm & Create"
        onConfirm={() => { void state.onSubmit(); }}
      >
        <div className="rounded-lg border border-ink/15 bg-ink/5 p-3 dark:border-white/10 dark:bg-white/5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-ink/60 dark:text-white/55">
            Transaction Summary
          </p>
          <div className="grid gap-1.5 text-sm">
            {state.includeA ? (
              <div className="flex justify-between gap-2">
                <span className="text-ink/70 dark:text-white/65">Vault Alpha</span>
                <span className="font-mono font-semibold">{state.amountA} DOT</span>
              </div>
            ) : null}
            {state.includeB ? (
              <div className="flex justify-between gap-2">
                <span className="text-ink/70 dark:text-white/65">Vault Beta</span>
                <span className="font-mono font-semibold">{state.amountB} DOT</span>
              </div>
            ) : null}
            <div className="flex justify-between gap-2">
              <span className="text-ink/70 dark:text-white/65">Duration</span>
              <span className="font-semibold">{durationLabel}</span>
            </div>
            <div className="flex justify-between gap-2 border-t border-ink/10 pt-1 dark:border-white/10">
              <span className="font-semibold text-ink dark:text-white">Total Bond</span>
              <span className="font-mono font-bold">{formatDot(state.preview.totalBond)}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-ink/70 dark:text-white/65">Est. Gas</span>
              <span className="font-mono font-semibold">
                {state.gasEstimateUnable
                  ? "Unable to estimate"
                  : state.gasEstimate
                    ? `~${state.gasEstimate}`
                    : "Calculating..."}
              </span>
            </div>
          </div>
        </div>
      </ConfirmDialog>
    </section>
  );
}
