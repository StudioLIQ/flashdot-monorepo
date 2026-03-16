"use client";

import { BrowserProvider, Contract, formatEther } from "ethers";
import { useEffect, useMemo, useState } from "react";

import type { LegView } from "../lib/loan-types";
import { LegState } from "../lib/loan-types";
import { VAULT_ABI, type VaultWriteContract } from "../lib/contracts";

const LEG_STEPS = [
  { label: "PrepareSent", state: LegState.PrepareSent },
  { label: "PreparedAcked", state: LegState.PreparedAcked },
  { label: "CommitSent", state: LegState.CommitSent },
  { label: "CommittedAcked", state: LegState.CommittedAcked },
  { label: "RepaidConfirmed", state: LegState.RepaidConfirmed },
] as const;

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

  const countdown = useMemo(() => formatRemaining(leg.expiryAt - nowSec), [leg.expiryAt, nowSec]);

  const canRepay = leg.state === LegState.CommittedAcked;

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
    <article className="rounded-xl border border-ink/15 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">Leg #{leg.legId} · {shortAddress(leg.vault)}</h3>
        <p className="text-xs text-ink/60">Principal: {formatDotAmount(leg.amount)}</p>
      </div>

      <ol className="mt-3 grid gap-2 text-xs text-ink/70 sm:grid-cols-5">
        {LEG_STEPS.map((step) => {
          const done = leg.state >= step.state;
          return (
            <li
              key={step.label}
              className={`rounded-lg border px-2 py-2 ${done ? "border-neon/40 bg-mint text-ink" : "border-ink/10 bg-ink/5"}`}
            >
              <span className="mr-1">{done ? "●" : "○"}</span>
              {step.label}
            </li>
          );
        })}
      </ol>

      {canRepay ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <p className="text-sm text-ink/80">Repay countdown: {countdown}</p>
          <button
            type="button"
            onClick={() => void repay()}
            disabled={isRepaying}
            className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-ink disabled:cursor-not-allowed disabled:bg-ink/20 disabled:text-ink/50"
          >
            {isRepaying ? "Repaying..." : "Repay"}
          </button>
        </div>
      ) : null}

      {repayError ? <p className="mt-2 text-xs text-red-600">{repayError}</p> : null}
    </article>
  );
}
