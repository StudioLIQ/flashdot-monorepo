"use client";

import { BrowserProvider, Contract, parseEther, formatEther } from "ethers";
import { ExternalLink, Globe, Wallet } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { BondPreviewChart } from "./BondPreviewChart";
import { ConfirmDialog } from "./ConfirmDialog";
import { useWallet } from "../hooks/useWallet";
import { useBondPreview } from "../hooks/useBondPreview";
import { useToast } from "../providers/ToastProvider";
import {
  ASSET_ADDRESS,
  CHAIN_A,
  CHAIN_B,
  EXPLORER_TX_URL,
  HUB_ADDRESS,
  HUB_ABI,
  VAULT_A_ADDRESS,
  VAULT_B_ADDRESS,
  getHubContract,
} from "../lib/contracts";
import { addTxRecord } from "../lib/tx-history";

const INTEREST_BPS = 100;
const HUB_FEE_BUFFER = parseEther("0.01");
const FEE_BUDGET_A = parseEther("0.05");
const FEE_BUDGET_B = parseEther("0.05");
const MOCK_LIQUIDITY_A = "50,000 DOT";
const MOCK_LIQUIDITY_B = "42,000 DOT";
const MAX_LIQUIDITY_A = "50000";
const MAX_LIQUIDITY_B = "42000";
const INTEREST_LABEL = `${(INTEREST_BPS / 100).toFixed(2)}% (${INTEREST_BPS} bps)`;
const AMOUNT_PRESETS = ["100", "500", "1000", "5000"] as const;
const DURATION_PRESETS = ["15", "30", "60", "120"] as const;

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

function shortAddress(address: string): string {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function CreateLoan(): JSX.Element {
  const { isConnected, isCorrectNetwork } = useWallet();
  const { showToast } = useToast();

  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);
  const [compactMode, setCompactMode] = useState(false);
  const [includeA, setIncludeA] = useState(true);
  const [includeB, setIncludeB] = useState(true);
  const [amountA, setAmountA] = useState("1000");
  const [amountB, setAmountB] = useState("2000");
  const [durationMinutes, setDurationMinutes] = useState("60");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [gasEstimate, setGasEstimate] = useState<string | null>(null);
  const [gasEstimateUnable, setGasEstimateUnable] = useState(false);
  const [submittedBondAmount, setSubmittedBondAmount] = useState<bigint | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createdLoanId, setCreatedLoanId] = useState<string | null>(null);
  const [createdTxHash, setCreatedTxHash] = useState<string | null>(null);

  const amountABigint = useMemo(() => toAmount(amountA), [amountA]);
  const amountBBigint = useMemo(() => toAmount(amountB), [amountB]);
  const isInvalidA = amountA.length > 0 && amountABigint === 0n && amountA !== "0";
  const isInvalidB = amountB.length > 0 && amountBBigint === 0n && amountB !== "0";

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

  // Debounced gas estimation
  useEffect(() => {
    if (!isConnected || !isCorrectNetwork || preview.targetAmount === 0n) {
      setGasEstimate(null);
      setGasEstimateUnable(false);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const ethereum = (window as EthereumWindow).ethereum;
        if (!ethereum || !HUB_ADDRESS) return;
        const provider = new BrowserProvider(ethereum as any); // eslint-disable-line @typescript-eslint/no-explicit-any
        const signer = await provider.getSigner();
        const hub = new Contract(HUB_ADDRESS, HUB_ABI, signer);
        const durationSec = Math.max(5, Number(durationMinutes) || 60) * 60;
        const expiryAt = Math.floor(Date.now() / 1000) + durationSec;
        const legs = [];
        if (includeA) legs.push({ chain: CHAIN_A, vault: VAULT_A_ADDRESS, amount: amountABigint, feeBudget: FEE_BUDGET_A, legInterestBps: INTEREST_BPS });
        if (includeB) legs.push({ chain: CHAIN_B, vault: VAULT_B_ADDRESS, amount: amountBBigint, feeBudget: FEE_BUDGET_B, legInterestBps: INTEREST_BPS });
        if (!legs.length) return;
        const params = { asset: ASSET_ADDRESS, targetAmount: preview.targetAmount, interestBps: INTEREST_BPS, expiryAt };
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        const gasUnits = await (hub as any).createLoan.estimateGas(params, legs) as bigint;
        const feeData = await provider.getFeeData();
        const gasPrice = feeData.gasPrice ?? 1_000_000_000n;
        const costWei = gasUnits * gasPrice;
        if (!cancelled) {
          setGasEstimate(formatDot(costWei));
          setGasEstimateUnable(false);
        }
      } catch {
        if (!cancelled) {
          setGasEstimate(null);
          setGasEstimateUnable(true);
        }
      }
    }, 600);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [isConnected, isCorrectNetwork, amountABigint, amountBBigint, includeA, includeB, durationMinutes, preview.targetAmount]);

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
    setCreatedTxHash(null);

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
      const txHash = (receipt as { hash?: string }).hash ?? null;

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
      setCreatedTxHash(txHash);
      if (txHash) {
        addTxRecord({
          label: nextLoanId ? `Create Loan #${nextLoanId}` : "Create Loan",
          txHash,
          status: "confirmed",
          timestamp: Math.floor(Date.now() / 1000),
          explorerUrl: EXPLORER_TX_URL(txHash),
        });
      }
      setMessage("Loan created successfully. Bond lock transaction confirmed.");
      showToast({
        tone: "success",
        title: nextLoanId ? `Loan #${nextLoanId} created` : "Loan created",
        description: `Bond locked: ${formatDot(preview.totalBond)}`,
        ...(txHash ? { link: { href: EXPLORER_TX_URL(txHash), label: "View on Explorer" } } : {}),
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

  const WIZARD_STEPS = [
    { num: 1, label: "Select Vaults" },
    { num: 2, label: "Set Terms" },
    { num: 3, label: "Review & Confirm" },
  ] as const;

  const canProceedToStep2 = includeA || includeB;
  const canProceedToStep3 = canProceedToStep2 && (includeA ? amountABigint > 0n && !isInvalidA : true) && (includeB ? amountBBigint > 0n && !isInvalidB : true);

  const durationLabel = Number(durationMinutes) >= 60
    ? `${(Number(durationMinutes) / 60).toFixed(Number(durationMinutes) % 60 === 0 ? 0 : 1)}h`
    : `${durationMinutes}m`;

  const navBtnBase = "inline-flex min-h-11 items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all active:scale-[0.97]";
  const navBtnSecondary = `${navBtnBase} border border-ink/20 hover:bg-ink/5 dark:border-white/15 dark:hover:bg-white/10`;
  const navBtnPrimary = `${navBtnBase} bg-primary text-primary-fg hover:bg-primary-hover disabled:cursor-not-allowed disabled:bg-ink/20 disabled:text-ink/50 dark:disabled:bg-white/15 dark:disabled:text-white/35`;

  const gasLine = isConnected && isCorrectNetwork ? (
    <p className="font-mono text-xs text-ink/60 dark:text-white/55">
      {gasEstimateUnable ? "Est. Gas: Unable to estimate" : gasEstimate ? `Est. Gas: ~${gasEstimate}` : "Est. Gas: Calculating..."}
    </p>
  ) : null;

  const walletStatusBlock = (
    <div className="space-y-1" aria-live="polite">
      {!isConnected ? <p className="text-sm text-danger">Connect wallet first.</p> : null}
      {isConnected && !isCorrectNetwork ? (
        <p className="text-sm text-danger">Switch to Polkadot Hub EVM network.</p>
      ) : null}
    </div>
  );

  const submittingBlock = submitting ? (
    <div className="rounded-xl border border-ink/15 bg-ink/5 px-4 py-3 text-sm dark:border-white/10 dark:bg-white/5">
      <p className="inline-flex items-center gap-2 font-semibold">
        <Wallet size={16} className="shrink-0" />
        Waiting for confirmation in MetaMask...
      </p>
      <p className="mt-1 text-ink/70 dark:text-white/70">Review and approve the bond lock transaction in your wallet.</p>
    </div>
  ) : null;

  const successBlock = createdLoanId ? (
    <div className="animate-content-fade rounded-xl border border-success/45 bg-success/10 px-4 py-4 dark:border-success/40 dark:bg-success/20">
      <div className="inline-flex items-center gap-2">
        <span className="relative grid h-8 w-8 place-items-center rounded-full bg-success text-ink">
          <span className="absolute inset-0 rounded-full bg-success/45 animate-ping" />
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
          className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-fg hover:bg-primary-hover"
        >
          View Loan Status
        </button>
        {createdTxHash ? (
          <a
            href={EXPLORER_TX_URL(createdTxHash)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-lg border border-ink/20 px-3 py-2 text-sm font-semibold hover:bg-ink/5 dark:border-white/15 dark:hover:bg-white/10"
          >
            View on Explorer
            <ExternalLink size={12} />
          </a>
        ) : null}
        {message ? <p className="text-sm text-ink/75 dark:text-white/75">{message}</p> : null}
      </div>
    </div>
  ) : null;

  return (
    <section
      className="mt-8 rounded-2xl border border-ink/15 bg-white p-6 dark:border-white/10 dark:bg-white/5"
      aria-labelledby="create-loan-title"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 id="create-loan-title" className="text-xl font-semibold">Create Loan</h2>
          <p className="mt-0.5 text-sm text-ink/70 dark:text-white/65">Estimated bond breakdown before submission.</p>
        </div>
        <button
          type="button"
          onClick={() => { setCompactMode((v) => !v); setWizardStep(1); }}
          className="shrink-0 rounded-full border border-ink/20 px-3 py-1 text-xs font-semibold hover:bg-ink/5 dark:border-white/15 dark:hover:bg-white/10"
        >
          {compactMode ? "Guided" : "Compact"}
        </button>
      </div>

      {/* Wizard step indicator — guided mode only */}
      {!compactMode ? (
        <div className="mt-5 flex items-center gap-1" aria-label="Loan creation steps">
          {WIZARD_STEPS.map((s, idx) => (
            <div key={s.num} className="flex flex-1 items-center gap-1">
              <div className="flex flex-col items-center gap-1">
                <button
                  type="button"
                  onClick={() => wizardStep > s.num && setWizardStep(s.num as 1 | 2 | 3)}
                  disabled={wizardStep <= s.num}
                  className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold transition-colors ${
                    s.num === wizardStep
                      ? "bg-primary text-primary-fg"
                      : s.num < wizardStep
                        ? "cursor-pointer bg-primary/25 text-primary hover:bg-primary/35"
                        : "bg-ink/10 text-ink/40 dark:bg-white/10 dark:text-white/35"
                  }`}
                >
                  {s.num < wizardStep ? "✓" : s.num}
                </button>
                <span className={`hidden text-[10px] font-semibold sm:block ${s.num === wizardStep ? "text-ink dark:text-white" : "text-ink/45 dark:text-white/40"}`}>
                  {s.label}
                </span>
              </div>
              {idx < WIZARD_STEPS.length - 1 ? (
                <div className={`mb-4 h-px flex-1 ${s.num < wizardStep ? "bg-primary/40" : "bg-ink/15 dark:bg-white/10"}`} />
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {/* ── STEP 1: Select Vaults ── */}
      {!compactMode && wizardStep === 1 ? (
        <div className="mt-5">
          <div className="grid gap-3 md:grid-cols-2">
            <button
              type="button"
              onClick={() => setIncludeA((v) => !v)}
              className={`relative overflow-hidden rounded-2xl border p-4 text-left transition ${includeA ? "border-primary/25 bg-primary/8 dark:border-primary/20 dark:bg-primary/12" : "border-ink/15 bg-white/60 opacity-55 dark:border-white/10 dark:bg-white/5"}`}
            >
              <div className={`absolute left-0 top-0 h-full w-1 transition-colors ${includeA ? "bg-primary" : "bg-transparent"}`} />
              <div className="pl-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="grid h-8 w-8 place-items-center rounded-xl bg-primary/15">
                      <Globe size={14} className="text-primary" />
                    </div>
                    <p className="text-sm font-semibold">Parachain Alpha</p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${includeA ? "bg-primary/20 text-primary" : "bg-ink/10 text-ink/40 dark:bg-white/10 dark:text-white/35"}`}>
                    {includeA ? "✓ Selected" : "Not selected"}
                  </span>
                </div>
                <div className="mt-2 flex gap-4 text-xs text-ink/60 dark:text-white/55">
                  <span>Liquidity: {MOCK_LIQUIDITY_A}</span>
                  <span>Interest: {INTEREST_LABEL}</span>
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setIncludeB((v) => !v)}
              className={`relative overflow-hidden rounded-2xl border p-4 text-left transition ${includeB ? "border-info/25 bg-info/8 dark:border-info/20 dark:bg-info/12" : "border-ink/15 bg-white/60 opacity-55 dark:border-white/10 dark:bg-white/5"}`}
            >
              <div className={`absolute left-0 top-0 h-full w-1 transition-colors ${includeB ? "bg-info" : "bg-transparent"}`} />
              <div className="pl-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="grid h-8 w-8 place-items-center rounded-xl bg-info/15">
                      <Globe size={14} className="text-info" />
                    </div>
                    <p className="text-sm font-semibold">Parachain Beta</p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${includeB ? "bg-info/20 text-info" : "bg-ink/10 text-ink/40 dark:bg-white/10 dark:text-white/35"}`}>
                    {includeB ? "✓ Selected" : "Not selected"}
                  </span>
                </div>
                <div className="mt-2 flex gap-4 text-xs text-ink/60 dark:text-white/55">
                  <span>Liquidity: {MOCK_LIQUIDITY_B}</span>
                  <span>Interest: {INTEREST_LABEL}</span>
                </div>
              </div>
            </button>

            {!canProceedToStep2 ? (
              <p className="col-span-full text-xs text-danger">Select at least one vault to continue.</p>
            ) : null}
          </div>
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={() => setWizardStep(2)}
              disabled={!canProceedToStep2}
              className={navBtnPrimary}
            >
              Next →
            </button>
          </div>
        </div>
      ) : null}

      {/* ── STEP 2 or COMPACT: Set Terms (full vault cards + duration + bond preview) ── */}
      {(compactMode || wizardStep === 2) ? (
        <>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {/* Vault A — Parachain Alpha */}
            <article
              className={`relative overflow-hidden rounded-2xl border transition ${includeA ? "border-primary/25 bg-primary/8 shadow-[0_0_0_1px_rgba(66,219,141,0.12)] dark:border-primary/20 dark:bg-primary/12" : "border-ink/15 bg-white/60 opacity-60 grayscale dark:border-white/10 dark:bg-white/5"}`}
            >
              <div className={`absolute left-0 top-0 h-full w-1 transition-colors ${includeA ? "bg-primary" : "bg-transparent"}`} />
              <div className="px-5 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/15">
                      <Globe size={16} className="text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">Parachain Alpha</p>
                      {VAULT_A_ADDRESS ? (
                        <p className="font-mono text-[10px] text-ink/50 dark:text-white/45">{shortAddress(VAULT_A_ADDRESS)}</p>
                      ) : null}
                    </div>
                  </div>
                  <label className="relative inline-flex cursor-pointer items-center" aria-label="Include Parachain Alpha">
                    <input
                      id="include-vault-a"
                      type="checkbox"
                      checked={includeA}
                      onChange={(e) => setIncludeA(e.target.checked)}
                      className="peer sr-only"
                    />
                    <div className="peer h-5 w-9 rounded-full bg-ink/20 transition-colors dark:bg-white/20 peer-checked:bg-primary" />
                    <span className="absolute left-0.5 h-4 w-4 transform rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
                  </label>
                </div>

                <div className="mt-3 flex gap-4 text-xs">
                  <div>
                    <p className="text-ink/55 dark:text-white/50">Liquidity</p>
                    <p className="mt-0.5 font-semibold">{MOCK_LIQUIDITY_A}</p>
                  </div>
                  <div>
                    <p className="text-ink/55 dark:text-white/50">Interest</p>
                    <p className="mt-0.5 font-semibold">{INTEREST_LABEL}</p>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.08em] text-ink/65 dark:text-white/60">Amount</span>
                    <div className="flex gap-1">
                      <button type="button" onClick={() => setAmountA(MAX_LIQUIDITY_A)} className="rounded border border-ink/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide hover:bg-ink/5 dark:border-white/20 dark:hover:bg-white/10">MAX</button>
                      <button type="button" onClick={() => setAmountA(String(Number(MAX_LIQUIDITY_A) / 2))} className="rounded border border-ink/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide hover:bg-ink/5 dark:border-white/20 dark:hover:bg-white/10">50%</button>
                    </div>
                  </div>
                  <div className={`flex items-center rounded-xl border bg-white px-4 py-3 dark:bg-slate-900 ${isInvalidA ? "border-danger" : "border-ink/20 dark:border-white/15"}`}>
                    <input
                      id="vault-a-amount"
                      type="text"
                      inputMode="decimal"
                      pattern="^[0-9]*[.]?[0-9]*$"
                      value={amountA}
                      onChange={(e) => setAmountA(e.target.value)}
                      aria-label="Vault A amount in DOT"
                      aria-invalid={isInvalidA}
                      className="w-full bg-transparent font-mono text-2xl font-semibold text-right outline-none"
                    />
                    <span className="ml-2 text-sm font-semibold text-ink/50 dark:text-white/45">DOT</span>
                  </div>
                  {isInvalidA ? (
                    <p className="mt-1 text-xs text-danger">Invalid amount</p>
                  ) : (
                    <p className="mt-1 text-right text-xs text-ink/55 dark:text-white/50">Available: {MOCK_LIQUIDITY_A}</p>
                  )}
                </div>

                <div className="mt-2 flex flex-wrap gap-1.5">
                  {AMOUNT_PRESETS.map((preset) => (
                    <button key={`vault-a-${preset}`} type="button" onClick={() => setAmountA(preset)} className={`min-h-8 rounded-lg border px-2 py-1 text-xs font-semibold ${amountA === preset ? "border-primary/50 bg-primary/15" : "border-ink/20 hover:bg-ink/5 dark:border-white/20 dark:hover:bg-white/10"}`}>
                      {preset}
                    </button>
                  ))}
                </div>
              </div>
            </article>

            {/* Vault B — Parachain Beta */}
            <article
              className={`relative overflow-hidden rounded-2xl border transition ${includeB ? "border-info/25 bg-info/8 shadow-[0_0_0_1px_rgba(96,165,250,0.12)] dark:border-info/20 dark:bg-info/12" : "border-ink/15 bg-white/60 opacity-60 grayscale dark:border-white/10 dark:bg-white/5"}`}
            >
              <div className={`absolute left-0 top-0 h-full w-1 transition-colors ${includeB ? "bg-info" : "bg-transparent"}`} />
              <div className="px-5 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="grid h-9 w-9 place-items-center rounded-xl bg-info/15">
                      <Globe size={16} className="text-info" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">Parachain Beta</p>
                      {VAULT_B_ADDRESS ? (
                        <p className="font-mono text-[10px] text-ink/50 dark:text-white/45">{shortAddress(VAULT_B_ADDRESS)}</p>
                      ) : null}
                    </div>
                  </div>
                  <label className="relative inline-flex cursor-pointer items-center" aria-label="Include Parachain Beta">
                    <input
                      id="include-vault-b"
                      type="checkbox"
                      checked={includeB}
                      onChange={(e) => setIncludeB(e.target.checked)}
                      className="peer sr-only"
                    />
                    <div className="peer h-5 w-9 rounded-full bg-ink/20 transition-colors dark:bg-white/20 peer-checked:bg-info" />
                    <span className="absolute left-0.5 h-4 w-4 transform rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
                  </label>
                </div>

                <div className="mt-3 flex gap-4 text-xs">
                  <div>
                    <p className="text-ink/55 dark:text-white/50">Liquidity</p>
                    <p className="mt-0.5 font-semibold">{MOCK_LIQUIDITY_B}</p>
                  </div>
                  <div>
                    <p className="text-ink/55 dark:text-white/50">Interest</p>
                    <p className="mt-0.5 font-semibold">{INTEREST_LABEL}</p>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.08em] text-ink/65 dark:text-white/60">Amount</span>
                    <div className="flex gap-1">
                      <button type="button" onClick={() => setAmountB(MAX_LIQUIDITY_B)} className="rounded border border-ink/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide hover:bg-ink/5 dark:border-white/20 dark:hover:bg-white/10">MAX</button>
                      <button type="button" onClick={() => setAmountB(String(Number(MAX_LIQUIDITY_B) / 2))} className="rounded border border-ink/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide hover:bg-ink/5 dark:border-white/20 dark:hover:bg-white/10">50%</button>
                    </div>
                  </div>
                  <div className={`flex items-center rounded-xl border bg-white px-4 py-3 dark:bg-slate-900 ${isInvalidB ? "border-danger" : "border-ink/20 dark:border-white/15"}`}>
                    <input
                      id="vault-b-amount"
                      type="text"
                      inputMode="decimal"
                      pattern="^[0-9]*[.]?[0-9]*$"
                      value={amountB}
                      onChange={(e) => setAmountB(e.target.value)}
                      aria-label="Vault B amount in DOT"
                      aria-invalid={isInvalidB}
                      className="w-full bg-transparent font-mono text-2xl font-semibold text-right outline-none"
                    />
                    <span className="ml-2 text-sm font-semibold text-ink/50 dark:text-white/45">DOT</span>
                  </div>
                  {isInvalidB ? (
                    <p className="mt-1 text-xs text-danger">Invalid amount</p>
                  ) : (
                    <p className="mt-1 text-right text-xs text-ink/55 dark:text-white/50">Available: {MOCK_LIQUIDITY_B}</p>
                  )}
                </div>

                <div className="mt-2 flex flex-wrap gap-1.5">
                  {AMOUNT_PRESETS.map((preset) => (
                    <button key={`vault-b-${preset}`} type="button" onClick={() => setAmountB(preset)} className={`min-h-8 rounded-lg border px-2 py-1 text-xs font-semibold ${amountB === preset ? "border-info/50 bg-info/15" : "border-ink/20 hover:bg-ink/5 dark:border-white/20 dark:hover:bg-white/10"}`}>
                      {preset}
                    </button>
                  ))}
                </div>
              </div>
            </article>
          </div>

          {/* Duration slider */}
          <div className="mt-4 rounded-xl border border-ink/15 bg-surface p-4 dark:border-white/10 dark:bg-surface-dark">
            <div className="flex items-center justify-between gap-3">
              <label htmlFor="loan-duration-minutes" className="text-sm font-medium">Duration</label>
              <span className="font-mono text-sm font-semibold">{durationLabel}</span>
            </div>
            <input
              id="loan-duration-minutes"
              type="range"
              min={5}
              max={180}
              step={5}
              value={Number(durationMinutes) || 60}
              onChange={(e) => setDurationMinutes(e.target.value)}
              aria-label="Loan duration in minutes"
              className={`mt-3 h-2 w-full cursor-pointer appearance-none rounded-full outline-none ${
                Number(durationMinutes) < 15
                  ? "[&::-webkit-slider-runnable-track]:bg-danger/30 [&::-webkit-slider-thumb]:bg-danger"
                  : "[&::-webkit-slider-runnable-track]:bg-ink/15 [&::-webkit-slider-thumb]:bg-primary dark:[&::-webkit-slider-runnable-track]:bg-white/15"
              } [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-sm`}
            />
            {Number(durationMinutes) < 15 ? (
              <p className="mt-1 text-xs font-semibold text-danger">
                Warning: durations under 15 min are high-risk. You may not have time to repay.
              </p>
            ) : null}
            <p className="mt-2 font-mono text-xs text-ink/60 dark:text-white/55">
              Expires at:{" "}
              {new Date(Date.now() + (Number(durationMinutes) || 60) * 60 * 1000).toLocaleTimeString(undefined, {
                hour: "2-digit",
                minute: "2-digit",
              })}{" "}
              ({new Date(Date.now() + (Number(durationMinutes) || 60) * 60 * 1000).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
              })})
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {DURATION_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setDurationMinutes(preset)}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                    durationMinutes === preset
                      ? "border-primary/50 bg-primary/15 text-ink dark:text-white"
                      : "border-ink/20 hover:bg-ink/5 dark:border-white/20 dark:hover:bg-white/10"
                  }`}
                >
                  {Number(preset) >= 60 ? `${Number(preset) / 60}hr` : `${preset}min`}
                </button>
              ))}
            </div>
          </div>

          <BondPreviewChart
            repayA={preview.repayA}
            repayB={preview.repayB}
            feeBudgets={preview.feeBudgets}
            hubBuffer={HUB_FEE_BUFFER}
            totalBond={preview.totalBond}
          />

          {/* Step 2 guided: Back + Next navigation */}
          {!compactMode ? (
            <div className="mt-5 flex items-center justify-between gap-3">
              <button type="button" onClick={() => setWizardStep(1)} className={navBtnSecondary}>
                ← Back
              </button>
              <button
                type="button"
                onClick={() => setWizardStep(3)}
                disabled={!canProceedToStep3}
                className={navBtnPrimary}
              >
                Next →
              </button>
            </div>
          ) : null}

          {/* Compact mode: gas + submit + status */}
          {compactMode ? (
            <div className="mt-4 space-y-3">
              {gasLine}
              <button
                type="button"
                onClick={() => setConfirmOpen(true)}
                disabled={!canSubmit}
                aria-label="Create loan and lock bond"
                className={`inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition-all active:scale-[0.97] disabled:cursor-not-allowed disabled:bg-ink/20 disabled:text-ink/50 dark:disabled:bg-white/15 dark:disabled:text-white/35 sm:min-h-11 sm:w-auto ${createdLoanId ? "animate-success-morph bg-primary text-primary-fg" : "bg-primary text-primary-fg hover:bg-primary-hover"}`}
              >
                {submitting ? <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent dark:border-ink dark:border-t-transparent" /> : null}
                {createdLoanId && !submitting ? "Created ✓" : submitLabel}
              </button>
              {walletStatusBlock}
              {submittingBlock}
              {successBlock}
              {error ? <p className="text-sm text-danger">{error}</p> : null}
            </div>
          ) : null}
        </>
      ) : null}

      {/* ── STEP 3: Review & Confirm ── */}
      {!compactMode && wizardStep === 3 ? (
        <div className="mt-6 space-y-4">
          {/* Review summary card */}
          <div className="rounded-xl border border-ink/15 bg-surface p-4 dark:border-white/10 dark:bg-surface-dark">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-ink/60 dark:text-white/55">Review Summary</p>
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

          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            disabled={!canSubmit}
            aria-label="Create loan and lock bond"
            className={`inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition-all active:scale-[0.97] disabled:cursor-not-allowed disabled:bg-ink/20 disabled:text-ink/50 dark:disabled:bg-white/15 dark:disabled:text-white/35 sm:min-h-11 ${createdLoanId ? "animate-success-morph bg-primary text-primary-fg" : "bg-primary text-primary-fg hover:bg-primary-hover"}`}
          >
            {submitting ? <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent dark:border-ink dark:border-t-transparent" /> : null}
            {createdLoanId && !submitting ? "Created ✓" : submitLabel}
          </button>

          {walletStatusBlock}
          {submittingBlock}
          {successBlock}
          {error ? <p className="text-sm text-danger">{error}</p> : null}

          {!createdLoanId ? (
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setWizardStep(2)} className={navBtnSecondary}>
                ← Back
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Confirm dialog — always mounted */}
      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Confirm Bond Lock"
        description="This sends an on-chain transaction and requires a wallet signature."
        confirmLabel="Confirm & Create"
        onConfirm={() => { void onSubmit(); }}
      >
        <div className="rounded-lg border border-ink/15 bg-ink/5 p-3 dark:border-white/10 dark:bg-white/5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-ink/60 dark:text-white/55">Transaction Summary</p>
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
                {gasEstimateUnable ? "Unable to estimate" : gasEstimate ? `~${gasEstimate}` : "Calculating..."}
              </span>
            </div>
          </div>
        </div>
      </ConfirmDialog>
    </section>
  );
}
