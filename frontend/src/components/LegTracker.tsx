"use client";

import { BrowserProvider, Contract, formatEther } from "ethers";
import { useEffect, useMemo, useState } from "react";

import type { LegView } from "../lib/loan-types";
import { LEG_STEP_META, LegState } from "../lib/loan-types";
import { EXPLORER_TX_URL, VAULT_ABI, type VaultWriteContract } from "../lib/contracts";
import { addTxRecord } from "../lib/tx-history";
import { useToast } from "../providers/ToastProvider";
import { CircularCountdown } from "./CircularCountdown";
import { ConfirmDialog } from "./ConfirmDialog";
import { Tooltip } from "./Tooltip";

interface LegTrackerProps {
  leg: LegView;
  onRepaid?: () => void;
}

interface EthereumWindow extends Window {
  ethereum?: unknown;
}

function formatRemaining(seconds: number): string {
  if (seconds <= 0) return "expired";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

function shortAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatDotAmount(amount: bigint): string {
  return `${Number(formatEther(amount)).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  })} DOT`;
}

export function LegTracker({ leg, onRepaid }: LegTrackerProps): JSX.Element {
  const { showToast } = useToast();
  const [nowSec, setNowSec] = useState(Math.floor(Date.now() / 1000));
  const [isRepaying, setIsRepaying] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [repayError, setRepayError] = useState<string | null>(null);
  // Capture initial remaining seconds for circular progress scale
  const initialRemainingSec = useMemo(() => Math.max(60, leg.expiryAt - Math.floor(Date.now() / 1000)), [leg.expiryAt]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const timer = setInterval(() => {
      setNowSec(Math.floor(Date.now() / 1000));
    }, 1_000);

    return () => clearInterval(timer);
  }, []);

  const remainingSec = leg.expiryAt - nowSec;
  const countdown = useMemo(() => formatRemaining(remainingSec), [remainingSec]);

  const canRepay = leg.state === LegState.CommittedAcked;
  const currentStep = useMemo(
    () => [...LEG_STEP_META].reverse().find((step) => leg.state >= step.state) ?? null,
    [leg.state]
  );
  const activeStepIndex = useMemo(() => {
    const idx = LEG_STEP_META.findIndex((step) => leg.state <= step.state);
    return idx === -1 ? LEG_STEP_META.length - 1 : idx;
  }, [leg.state]);
  const countdownTone = useMemo(() => {
    if (remainingSec > 300) return "text-success";
    if (remainingSec > 60) return "text-warning";
    if (remainingSec > 0) return "animate-pulse text-danger";
    return "text-danger";
  }, [remainingSec]);
  const urgentRepay = remainingSec > 0 && remainingSec < 60;

  const repay = async (): Promise<void> => {
    const ethereum = (window as EthereumWindow).ethereum;
    if (!ethereum) {
      setRepayError("MetaMask provider not found");
      return;
    }

    setIsRepaying(true);
    setRepayError(null);

    try {
      const provider = new BrowserProvider(ethereum as any);
      const signer = await provider.getSigner();
      const vault = new Contract(leg.vault, VAULT_ABI, signer) as unknown as VaultWriteContract;

      const tx = await vault.repay(BigInt(leg.loanId), leg.repayAmount);
      const receipt = await tx.wait();
      const txHash = (receipt as { hash?: string }).hash ?? null;
      if (txHash) {
        addTxRecord({
          label: `Repay Loan #${leg.loanId} Leg #${leg.legId}`,
          txHash,
          status: "confirmed",
          timestamp: Math.floor(Date.now() / 1000),
          explorerUrl: EXPLORER_TX_URL(txHash),
        });
      }
      showToast({
        tone: "success",
        title: `Loan #${leg.loanId} leg repaid`,
        description: `${formatDotAmount(leg.repayAmount)} sent to ${shortAddress(leg.vault)}.`,
        ...(txHash ? { link: { href: EXPLORER_TX_URL(txHash), label: "View on Explorer" } } : {}),
      });
      onRepaid?.();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setRepayError(message);
      showToast({
        tone: "error",
        title: "Repay transaction failed",
        description: message,
      });
    } finally {
      setIsRepaying(false);
    }
  };

  return (
    <article className="interactive-card interactive-card-lift rounded-xl border border-ink/15 bg-white p-4 dark:border-white/10 dark:bg-white/5" aria-labelledby={`leg-${leg.loanId}-${leg.legId}-title`}>
      <div className="flex items-center justify-between gap-3">
        <h3 id={`leg-${leg.loanId}-${leg.legId}-title`} className="flex items-center gap-1 text-sm font-semibold">
          <span>Leg #{leg.legId}</span>
          <Tooltip content="A Leg is a single cross-chain borrowing unit. Each leg borrows from one vault on a remote parachain via XCM." icon />
          <span className="text-ink/40 dark:text-white/35"> · {shortAddress(leg.vault)}</span>
        </h3>
        <p className="inline-flex items-center gap-1 text-xs text-ink/60 dark:text-white/55">
          {currentStep ? <><currentStep.icon size={12} className="shrink-0" />{currentStep.label}</> : "Initialized"}{" · "}Principal: {formatDotAmount(leg.amount)}
        </p>
      </div>

      {/* Mobile: compact step indicator */}
      <div className="mt-4 sm:hidden">
        <div className="flex items-center justify-between text-xs font-semibold text-ink/60 dark:text-white/55">
          <span>Step {activeStepIndex + 1} of {LEG_STEP_META.length}</span>
          {currentStep ? (
            <span className="inline-flex items-center gap-1 text-success">
              <currentStep.icon size={11} />
              {currentStep.label}
            </span>
          ) : null}
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink/10 dark:bg-white/10">
          <div
            className="h-full rounded-full bg-success transition-[width] duration-500 ease-out"
            style={{ width: `${Math.round(((activeStepIndex) / (LEG_STEP_META.length - 1)) * 100)}%` }}
          />
        </div>
      </div>

      {/* Desktop: horizontal timeline */}
      <ol className="mt-4 hidden text-[11px] text-ink/75 sm:flex sm:gap-1 dark:text-white/70">
        {LEG_STEP_META.map((step, index) => {
          const done = leg.state > step.state;
          const current = leg.state === step.state;
          const nextStep = LEG_STEP_META[index + 1];
          const connectorDone = Boolean(nextStep && leg.state >= nextStep.state);

          return (
            <li key={step.label} className="flex flex-1 items-start">
              <div className="flex flex-col items-center text-center" style={{ minWidth: "2rem" }}>
                <span className="relative grid h-6 w-6 shrink-0 place-items-center rounded-full border transition-colors duration-300 ease-out">
                  {current ? (
                    <span className="animate-step-ring absolute inset-0 rounded-full border-2 border-success" aria-hidden />
                  ) : null}
                  <span
                    className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border transition-colors duration-300 ease-out ${
                      done ? "border-success bg-success text-ink" :
                      current ? "border-success bg-success/20 text-success dark:bg-success/30" :
                      "border-ink/25 text-ink/45 dark:border-white/25 dark:text-white/45"
                    }`}
                  >
                    <step.icon size={11} strokeWidth={2.5} />
                  </span>
                </span>
                <span className="mt-2 leading-tight">{step.label}</span>
              </div>
              {index < LEG_STEP_META.length - 1 ? (
                connectorDone
                  ? <div aria-hidden className="mx-1 mt-3 h-[2px] flex-1 rounded-full bg-gradient-to-r from-success/70 to-success/40" />
                  : <div aria-hidden className="mx-1 mt-3 flex-1 border-t-2 border-dashed border-ink/20 dark:border-white/15" />
              ) : null}
            </li>
          );
        })}
      </ol>

      {canRepay ? (
        <div className="mt-4">
          <div className="flex items-end justify-between gap-3">
            <CircularCountdown
              totalSeconds={initialRemainingSec}
              remainingSeconds={remainingSec}
              size={72}
            />
            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              disabled={isRepaying}
              aria-label={`Repay ${formatDotAmount(leg.repayAmount)} to vault ${shortAddress(leg.vault)}`}
              className={`flex-1 inline-flex min-h-12 items-center justify-center rounded-lg px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:bg-ink/20 disabled:text-ink/50 dark:disabled:bg-white/15 dark:disabled:text-white/35 sm:min-h-11 ${urgentRepay ? "animate-pulse bg-danger text-white dark:bg-danger" : "bg-primary text-primary-fg hover:bg-primary-hover"}`}
            >
              {isRepaying ? "Repaying..." : `Repay ${formatDotAmount(leg.repayAmount)}`}
            </button>
          </div>
        </div>
      ) : null}

      {repayError ? <p role="alert" className="mt-2 text-xs text-danger">{repayError}</p> : null}

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Confirm Repayment"
        description="This action cannot be undone."
        confirmLabel="Confirm Repay"
        onConfirm={() => {
          setConfirmOpen(false);
          void repay();
        }}
      >
        <div className="rounded-lg border border-ink/15 bg-ink/5 p-3 dark:border-white/10 dark:bg-white/5">
          <div className="grid gap-1.5 text-sm">
            <div className="flex justify-between gap-2">
              <span className="text-ink/70 dark:text-white/65">Repay Amount</span>
              <span className="font-mono font-semibold">{formatDotAmount(leg.repayAmount)}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-ink/70 dark:text-white/65">Vault</span>
              <span className="font-mono text-xs font-semibold">{shortAddress(leg.vault)}</span>
            </div>
          </div>
        </div>
      </ConfirmDialog>
    </article>
  );
}
