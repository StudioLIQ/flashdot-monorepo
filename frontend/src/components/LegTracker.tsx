"use client";

import { BrowserProvider, Contract, formatEther } from "ethers";
import { useEffect, useMemo, useState } from "react";

import type { LegView } from "../lib/loan-types";
import { LEG_STEP_META, LegState } from "../lib/loan-types";
import { VAULT_ABI, type VaultWriteContract } from "../lib/contracts";

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
  const [nowSec, setNowSec] = useState(Math.floor(Date.now() / 1000));
  const [isRepaying, setIsRepaying] = useState(false);
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
      onRepaid?.();
    } catch (error) {
      setRepayError(error instanceof Error ? error.message : String(error));
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

      <ol className="mt-4 flex gap-1 text-[11px] text-ink/75 dark:text-white/70">
        {LEG_STEP_META.map((step, index) => {
          const done = leg.state > step.state;
          const current = leg.state === step.state;
          const nextStep = LEG_STEP_META[index + 1];
          const connectorDone = Boolean(nextStep && leg.state >= nextStep.state);

          return (
            <li key={step.label} className="flex flex-1 items-start">
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
                  className={`mt-3 h-[2px] flex-1 rounded ${connectorDone ? "bg-neon/75" : "bg-ink/20 dark:bg-white/20"}`}
                />
              ) : null}
            </li>
          );
        })}
      </ol>

      {canRepay ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <p className={`text-sm font-semibold ${countdownTone}`}>Repay countdown: {countdown}</p>
          <button
            type="button"
            onClick={() => void repay()}
            disabled={isRepaying}
            className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-ink disabled:cursor-not-allowed disabled:bg-ink/20 disabled:text-ink/50 dark:bg-amber-400 dark:text-slate-950 dark:disabled:bg-white/15 dark:disabled:text-white/35"
          >
            {isRepaying ? "Repaying..." : "Repay"}
          </button>
        </div>
      ) : null}

      {repayError ? <p className="mt-2 text-xs text-red-600 dark:text-red-300">{repayError}</p> : null}
    </article>
  );
}
