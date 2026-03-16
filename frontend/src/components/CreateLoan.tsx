"use client";

import { parseEther, formatEther } from "ethers";
import { useMemo, useState } from "react";

import { useWallet } from "../hooks/useWallet";
import { useBondPreview } from "../hooks/useBondPreview";
import {
  ASSET_ADDRESS,
  CHAIN_A,
  CHAIN_B,
  VAULT_A_ADDRESS,
  VAULT_B_ADDRESS,
  getHubContract,
} from "../lib/contracts";

const INTEREST_BPS = 100;
const HUB_FEE_BUFFER = parseEther("0.01");
const FEE_BUDGET_A = parseEther("0.05");
const FEE_BUDGET_B = parseEther("0.05");

interface EthereumWindow extends Window {
  ethereum?: unknown;
}

function toAmount(raw: string): bigint {
  if (!raw) return 0n;
  try {
    return parseEther(raw);
  } catch {
    return 0n;
  }
}

function formatDot(value: bigint): string {
  return `${Number(formatEther(value)).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  })} DOT`;
}

export function CreateLoan(): JSX.Element {
  const { isConnected, isCorrectNetwork } = useWallet();

  const [includeA, setIncludeA] = useState(true);
  const [includeB, setIncludeB] = useState(true);
  const [amountA, setAmountA] = useState("1000");
  const [amountB, setAmountB] = useState("2000");
  const [durationMinutes, setDurationMinutes] = useState("60");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createdLoanId, setCreatedLoanId] = useState<string | null>(null);

  const amountABigint = useMemo(() => toAmount(amountA), [amountA]);
  const amountBBigint = useMemo(() => toAmount(amountB), [amountB]);

  const preview = useBondPreview({
    amountA: amountABigint,
    amountB: amountBBigint,
    includeA,
    includeB,
    legInterestBps: INTEREST_BPS,
    feeBudgetA: FEE_BUDGET_A,
    feeBudgetB: FEE_BUDGET_B,
    hubFeeBuffer: HUB_FEE_BUFFER,
  });

  const canSubmit =
    isConnected &&
    isCorrectNetwork &&
    !submitting &&
    preview.targetAmount > 0n &&
    (includeA || includeB) &&
    Boolean(ASSET_ADDRESS) &&
    (includeA ? Boolean(VAULT_A_ADDRESS) : true) &&
    (includeB ? Boolean(VAULT_B_ADDRESS) : true);

  const submitLabel = submitting ? "Creating..." : "Create Loan & Lock Bond";

  const onSubmit = async (): Promise<void> => {
    if (!canSubmit) return;

    const ethereum = (window as EthereumWindow).ethereum;

    setSubmitting(true);
    setError(null);
    setMessage(null);
    setCreatedLoanId(null);

    try {
      const hub = await getHubContract(ethereum);
      const durationSec = Math.max(5, Number(durationMinutes) || 60) * 60;
      const expiryAt = Math.floor(Date.now() / 1000) + durationSec;

      const legs: Array<{
        chain: string;
        vault: string;
        amount: bigint;
        feeBudget: bigint;
        legInterestBps: number;
      }> = [];

      if (includeA) {
        legs.push({
          chain: CHAIN_A,
          vault: VAULT_A_ADDRESS,
          amount: amountABigint,
          feeBudget: FEE_BUDGET_A,
          legInterestBps: INTEREST_BPS,
        });
      }

      if (includeB) {
        legs.push({
          chain: CHAIN_B,
          vault: VAULT_B_ADDRESS,
          amount: amountBBigint,
          feeBudget: FEE_BUDGET_B,
          legInterestBps: INTEREST_BPS,
        });
      }

      const params = {
        asset: ASSET_ADDRESS,
        targetAmount: preview.targetAmount,
        interestBps: INTEREST_BPS,
        expiryAt,
      };

      const tx = await hub.createLoan(params, legs);
      const receipt = await tx.wait();

      for (const log of receipt.logs ?? []) {
        try {
          const parsed = hub.interface.parseLog(log);
          if (parsed?.name === "LoanCreated" && parsed.args[0]) {
            setCreatedLoanId(parsed.args[0].toString());
            break;
          }
        } catch {
          // Skip unrelated logs.
        }
      }

      setMessage("Loan created successfully. Bond lock transaction confirmed.");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : String(submitError));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="mt-8 rounded-2xl border border-ink/15 bg-white p-6 dark:border-white/10 dark:bg-white/5">
      <h2 className="text-xl font-semibold">Create Loan</h2>
      <p className="mt-1 text-sm text-ink/70 dark:text-white/65">Bond preview uses ceiling division and hub buffer.</p>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <label className="flex items-center gap-2 rounded-xl border border-ink/15 p-3 dark:border-white/10">
          <input type="checkbox" checked={includeA} onChange={(e) => setIncludeA(e.target.checked)} />
          <span className="text-sm font-semibold">Vault A</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={amountA}
            onChange={(e) => setAmountA(e.target.value)}
            className="ml-auto w-28 rounded-lg border border-ink/20 px-2 py-1 text-right text-sm dark:border-white/15 dark:bg-slate-900"
          />
        </label>

        <label className="flex items-center gap-2 rounded-xl border border-ink/15 p-3 dark:border-white/10">
          <input type="checkbox" checked={includeB} onChange={(e) => setIncludeB(e.target.checked)} />
          <span className="text-sm font-semibold">Vault B</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={amountB}
            onChange={(e) => setAmountB(e.target.value)}
            className="ml-auto w-28 rounded-lg border border-ink/20 px-2 py-1 text-right text-sm dark:border-white/15 dark:bg-slate-900"
          />
        </label>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <span className="text-sm font-medium">Duration (minutes)</span>
        <input
          type="number"
          min="5"
          step="1"
          value={durationMinutes}
          onChange={(e) => setDurationMinutes(e.target.value)}
          className="w-24 rounded-lg border border-ink/20 px-2 py-1 text-right text-sm dark:border-white/15 dark:bg-slate-900"
        />
      </div>

      <div className="mt-6 rounded-xl bg-mint p-4 text-sm dark:bg-emerald-950/50">
        <p>Repay A: {formatDot(preview.repayA)}</p>
        <p>Repay B: {formatDot(preview.repayB)}</p>
        <p>Fee budgets: {formatDot(preview.feeBudgets)}</p>
        <p>Hub fee buffer: {formatDot(HUB_FEE_BUFFER)}</p>
        <p className="mt-2 border-t border-ink/20 pt-2 text-base font-semibold dark:border-white/10">
          Total Bond Required: {formatDot(preview.totalBond)}
        </p>
      </div>

      <button
        type="button"
        onClick={() => void onSubmit()}
        disabled={!canSubmit}
        className="mt-5 inline-flex items-center gap-2 rounded-xl bg-ink px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-ink/20 disabled:text-ink/50 dark:bg-white dark:text-slate-950 dark:disabled:bg-white/15 dark:disabled:text-white/35"
      >
        {submitting ? <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" /> : null}
        {submitLabel}
      </button>

      {!isConnected ? <p className="mt-3 text-sm text-red-600">Connect wallet first.</p> : null}
      {isConnected && !isCorrectNetwork ? (
        <p className="mt-3 text-sm text-red-600">Switch to Polkadot Hub EVM network.</p>
      ) : null}
      {message ? <p className="mt-3 text-sm text-neon">{message}</p> : null}
      {createdLoanId ? <p className="mt-1 text-sm text-ink/80 dark:text-white/70">Loan ID: {createdLoanId}</p> : null}
      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
    </section>
  );
}
