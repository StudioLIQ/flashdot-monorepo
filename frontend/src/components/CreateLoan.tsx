"use client";

import { parseEther, formatEther } from "ethers";
import { useMemo, useState } from "react";

import { BondPreviewChart } from "./BondPreviewChart";
import { useWallet } from "../hooks/useWallet";
import { useBondPreview } from "../hooks/useBondPreview";
import { useToast } from "../providers/ToastProvider";
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
const MOCK_LIQUIDITY_A = "50,000 DOT";
const MOCK_LIQUIDITY_B = "42,000 DOT";
const INTEREST_LABEL = `${(INTEREST_BPS / 100).toFixed(2)}% (${INTEREST_BPS} bps)`;

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
  const { showToast } = useToast();

  const [includeA, setIncludeA] = useState(true);
  const [includeB, setIncludeB] = useState(true);
  const [amountA, setAmountA] = useState("1000");
  const [amountB, setAmountB] = useState("2000");
  const [durationMinutes, setDurationMinutes] = useState("60");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submittedBondAmount, setSubmittedBondAmount] = useState<bigint | null>(null);
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

  const scrollToStatus = (): void => {
    const statusZone = document.querySelector<HTMLElement>("#status-zone");
    statusZone?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const humanizeError = (rawError: unknown): string => {
    const source = rawError instanceof Error ? rawError.message : String(rawError);
    const lower = source.toLowerCase();

    if (lower.includes("user rejected") || lower.includes("action_rejected") || lower.includes("user denied")) {
      return "You cancelled the transaction.";
    }
    if (lower.includes("insufficient funds")) {
      return "Not enough DOT in wallet to lock this bond.";
    }
    if (lower.includes("missing next_public")) {
      return "Contract addresses are missing in frontend environment configuration.";
    }
    if (lower.includes("switch") || lower.includes("chain")) {
      return "Switch MetaMask to Polkadot Hub EVM and try again.";
    }

    return `Transaction failed. ${source}`;
  };

  const onSubmit = async (): Promise<void> => {
    if (!canSubmit) return;

    const ethereum = (window as EthereumWindow).ethereum;
    setConfirmOpen(false);

    setSubmitting(true);
    setSubmittedBondAmount(preview.totalBond);
    setError(null);
    setMessage(null);
    setCreatedLoanId(null);

    try {
      const hub = await getHubContract(ethereum);
      const durationSec = Math.max(5, Number(durationMinutes) || 60) * 60;
      const expiryAt = Math.floor(Date.now() / 1000) + durationSec;
      let nextLoanId: string | null = null;

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
            nextLoanId = parsed.args[0].toString();
            break;
          }
        } catch {
          // Skip unrelated logs.
        }
      }

      setCreatedLoanId(nextLoanId);
      setMessage("Loan created successfully. Bond lock transaction confirmed.");
      showToast({
        tone: "success",
        title: nextLoanId ? `Loan #${nextLoanId} created` : "Loan created",
        description: `Bond locked: ${formatDot(preview.totalBond)}`,
      });
      scrollToStatus();
    } catch (submitError) {
      const userMessage = humanizeError(submitError);
      setError(userMessage);
      showToast({
        tone: "error",
        title: "Loan creation failed",
        description: userMessage,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="interactive-card mt-8 rounded-2xl border border-ink/15 bg-white p-6 dark:border-white/10 dark:bg-white/5">
      <h2 className="text-xl font-semibold">Create Loan</h2>
      <p className="mt-1 text-sm text-ink/70 dark:text-white/65">Estimated bond breakdown before transaction submission.</p>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <article
          className={`rounded-2xl border p-4 transition ${includeA ? "border-neon bg-mint shadow-[0_0_0_1px_rgba(66,219,141,0.2)] dark:bg-emerald-950/45" : "border-ink/15 bg-white/60 opacity-65 dark:border-white/10 dark:bg-white/5"}`}
        >
          <p className="text-sm font-semibold">🔵 Parachain Alpha</p>
          <p className="mt-2 text-xs text-ink/70 dark:text-white/70">Available: {MOCK_LIQUIDITY_A}</p>
          <p className="mt-1 text-xs text-ink/70 dark:text-white/70">Interest: {INTEREST_LABEL}</p>
          <label className="mt-4 block text-xs font-semibold uppercase tracking-[0.08em] text-ink/65 dark:text-white/65">
            Amount
            <div className="mt-2 flex items-center gap-2 rounded-lg border border-ink/20 bg-white px-3 py-2 dark:border-white/15 dark:bg-slate-900">
              <input
                type="number"
                min="0"
                step="0.01"
                value={amountA}
                onChange={(e) => setAmountA(e.target.value)}
                className="w-full bg-transparent text-right text-sm outline-none"
              />
              <span className="text-xs font-semibold text-ink/65 dark:text-white/65">DOT</span>
            </div>
          </label>
          <label className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              checked={includeA}
              onChange={(e) => setIncludeA(e.target.checked)}
              className="h-5 w-5"
            />
            Include this vault
          </label>
        </article>

        <article
          className={`rounded-2xl border p-4 transition ${includeB ? "border-neon bg-mint shadow-[0_0_0_1px_rgba(66,219,141,0.2)] dark:bg-emerald-950/45" : "border-ink/15 bg-white/60 opacity-65 dark:border-white/10 dark:bg-white/5"}`}
        >
          <p className="text-sm font-semibold">🟢 Parachain Beta</p>
          <p className="mt-2 text-xs text-ink/70 dark:text-white/70">Available: {MOCK_LIQUIDITY_B}</p>
          <p className="mt-1 text-xs text-ink/70 dark:text-white/70">Interest: {INTEREST_LABEL}</p>
          <label className="mt-4 block text-xs font-semibold uppercase tracking-[0.08em] text-ink/65 dark:text-white/65">
            Amount
            <div className="mt-2 flex items-center gap-2 rounded-lg border border-ink/20 bg-white px-3 py-2 dark:border-white/15 dark:bg-slate-900">
              <input
                type="number"
                min="0"
                step="0.01"
                value={amountB}
                onChange={(e) => setAmountB(e.target.value)}
                className="w-full bg-transparent text-right text-sm outline-none"
              />
              <span className="text-xs font-semibold text-ink/65 dark:text-white/65">DOT</span>
            </div>
          </label>
          <label className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              checked={includeB}
              onChange={(e) => setIncludeB(e.target.checked)}
              className="h-5 w-5"
            />
            Include this vault
          </label>
        </article>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
        <span className="text-sm font-medium">Duration (minutes)</span>
        <input
          type="number"
          min="5"
          step="1"
          value={durationMinutes}
          onChange={(e) => setDurationMinutes(e.target.value)}
          className="min-h-11 w-full rounded-lg border border-ink/20 px-3 py-2 text-right text-sm dark:border-white/15 dark:bg-slate-900 sm:w-28"
        />
      </div>

      <BondPreviewChart
        repayA={preview.repayA}
        repayB={preview.repayB}
        feeBudgets={preview.feeBudgets}
        hubBuffer={HUB_FEE_BUFFER}
        totalBond={preview.totalBond}
      />

      <button
        type="button"
        onClick={() => setConfirmOpen(true)}
        disabled={!canSubmit}
        className={`mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:bg-ink/20 disabled:text-ink/50 dark:disabled:bg-white/15 dark:disabled:text-white/35 sm:w-auto ${createdLoanId ? "animate-success-morph bg-neon text-ink dark:bg-neon dark:text-ink" : "bg-ink text-white dark:bg-white dark:text-slate-950"}`}
      >
        {submitting ? <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent dark:border-ink dark:border-t-transparent" /> : null}
        {createdLoanId && !submitting ? "Created ✓" : submitLabel}
      </button>

      {!isConnected ? <p className="mt-3 text-sm text-red-600">Connect wallet first.</p> : null}
      {isConnected && !isCorrectNetwork ? (
        <p className="mt-3 text-sm text-red-600">Switch to Polkadot Hub EVM network.</p>
      ) : null}
      {submitting ? (
        <div className="mt-4 rounded-xl border border-ink/15 bg-ink/5 px-4 py-3 text-sm dark:border-white/10 dark:bg-white/5">
          <p className="inline-flex items-center gap-2 font-semibold">
            <span className="text-base">🦊</span>
            Waiting for confirmation in MetaMask...
          </p>
          <p className="mt-1 text-ink/70 dark:text-white/70">Review and approve the bond lock transaction in your wallet.</p>
        </div>
      ) : null}
      {createdLoanId ? (
        <div className="animate-content-fade mt-4 rounded-xl border border-neon/45 bg-mint px-4 py-4 dark:border-neon/40 dark:bg-emerald-950/40">
          <div className="inline-flex items-center gap-2">
            <span className="relative grid h-8 w-8 place-items-center rounded-full bg-neon text-ink">
              <span className="absolute inset-0 rounded-full bg-neon/45 animate-ping" />
              <span className="relative text-lg font-bold">✓</span>
            </span>
            <p className="text-lg font-bold text-ink dark:text-white">Loan #{createdLoanId} created!</p>
          </div>
          <p className="mt-2 text-sm text-ink/80 dark:text-white/80">
            Bond locked: {formatDot(submittedBondAmount ?? preview.totalBond)}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={scrollToStatus}
              className="rounded-lg bg-ink px-3 py-2 text-sm font-semibold text-white dark:bg-white dark:text-slate-950"
            >
              View Loan Status
            </button>
            {message ? <p className="text-sm text-ink/75 dark:text-white/75">{message}</p> : null}
          </div>
        </div>
      ) : null}
      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

      {confirmOpen ? (
        <div className="fixed inset-0 z-40 grid place-items-center bg-ink/55 px-4 backdrop-blur-sm dark:bg-slate-950/70">
          <div className="w-full max-w-md rounded-2xl border border-ink/10 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-slate-900">
            <h3 className="text-lg font-semibold">Confirm Bond Lock</h3>
            <p className="mt-2 text-sm text-ink/75 dark:text-white/75">
              Lock {formatDot(preview.totalBond)} as bond for this flash loan?
            </p>
            <p className="mt-1 text-xs text-ink/65 dark:text-white/60">
              This sends an on-chain transaction and requires a wallet signature.
            </p>
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
                  void onSubmit();
                }}
                className="rounded-lg bg-ink px-3 py-2 text-sm font-semibold text-white dark:bg-white dark:text-slate-950"
              >
                Confirm & Create
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
