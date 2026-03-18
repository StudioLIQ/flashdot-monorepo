"use client";

import { BrowserProvider, Contract, formatEther } from "ethers";
import { useEffect, useMemo, useState } from "react";

import type { LegView } from "../lib/loan-types";
import { LEG_STEP_META, LegState } from "../lib/loan-types";
import { VAULT_ABI, type VaultWriteContract } from "../lib/contracts";
import { useToast } from "../providers/ToastProvider";

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
  const countdownTone = useMemo(() => {
    if (remainingSec > 300) return "text-neon";
    if (remainingSec > 60) return "text-accent";
    if (remainingSec > 0) return "animate-pulse text-red-600 dark:text-red-300";
    return "text-red-700 dark:text-red-300";
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
      await tx.wait();
      showToast({
        tone: "success",
        title: `Loan #${leg.loanId} leg repaid`,
        description: `${formatDotAmount(leg.repayAmount)} sent to ${shortAddress(leg.vault)}.`,
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
    <article className="rounded-xl border border-ink/15 bg-white p-4 dark:border-white/10 dark:bg-white/5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">Leg #{leg.legId} · {shortAddress(leg.vault)}</h3>
        <p className="text-xs text-ink/60 dark:text-white/55">
          {currentStep ? `${currentStep.icon} ${currentStep.label}` : "Initialized"} · Principal: {formatDotAmount(leg.amount)}
        </p>
      </div>

      <ol className="mt-4 flex flex-col gap-3 text-[11px] text-ink/75 dark:text-white/70 sm:flex-row sm:gap-1">
        {LEG_STEP_META.map((step, index) => {
          const done = leg.state > step.state;
          const current = leg.state === step.state;
          const nextStep = LEG_STEP_META[index + 1];
          const connectorDone = Boolean(nextStep && leg.state >= nextStep.state);

          return (
            <li key={step.label} className="flex items-start sm:flex-1">
              <div className="flex min-w-8 flex-col items-center text-center">
                <span
                  className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border text-[10px] font-bold ${done ? "border-neon bg-neon text-ink" : ""} ${current ? "border-neon bg-mint text-ink animate-pulse dark:bg-emerald-950/60 dark:text-white" : ""} ${!done && !current ? "border-ink/25 text-ink/60 dark:border-white/25 dark:text-white/60" : ""}`}
                >
                  {step.icon}
                </span>
                <span className="mt-2 leading-tight">{step.label}</span>
              </div>
              {index < LEG_STEP_META.length - 1 ? (
                <span
                  aria-hidden
                  className={`ml-3 mt-1 h-5 w-[2px] shrink-0 rounded sm:ml-0 sm:mt-3 sm:h-[2px] sm:w-auto sm:flex-1 ${connectorDone ? "bg-neon/75" : "bg-ink/20 dark:bg-white/20"}`}
                />
              ) : null}
            </li>
          );
        })}
      </ol>

      {canRepay ? (
        <div className="mt-4">
          <p className={`text-sm font-semibold ${countdownTone}`}>Repay countdown: {countdown}</p>
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            disabled={isRepaying}
            className={`mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-lg px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:bg-ink/20 disabled:text-ink/50 dark:disabled:bg-white/15 dark:disabled:text-white/35 ${urgentRepay ? "animate-pulse bg-red-600 text-white dark:bg-red-500" : "bg-accent text-ink dark:bg-amber-400 dark:text-slate-950"}`}
          >
            {isRepaying ? "Repaying..." : `Repay ${formatDotAmount(leg.repayAmount)} to ${shortAddress(leg.vault)}`}
          </button>
        </div>
      ) : null}

      {repayError ? <p className="mt-2 text-xs text-red-600 dark:text-red-300">{repayError}</p> : null}

      {confirmOpen ? (
        <div className="fixed inset-0 z-40 grid place-items-center bg-ink/55 px-4 backdrop-blur-sm dark:bg-slate-950/70">
          <div className="w-full max-w-sm rounded-2xl border border-ink/10 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-slate-900">
            <h4 className="text-base font-semibold">Confirm Repayment</h4>
            <p className="mt-2 text-sm text-ink/75 dark:text-white/75">
              Repay {formatDotAmount(leg.repayAmount)} to {shortAddress(leg.vault)}?
            </p>
            <p className="mt-1 text-xs text-ink/65 dark:text-white/65">This action cannot be undone.</p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="rounded-lg border border-ink/20 px-3 py-2 text-sm font-semibold hover:bg-ink/5 dark:border-white/15 dark:hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmOpen(false);
                  void repay();
                }}
                className="rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-ink dark:bg-amber-400 dark:text-slate-950"
              >
                Confirm Repay
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </article>
  );
}
