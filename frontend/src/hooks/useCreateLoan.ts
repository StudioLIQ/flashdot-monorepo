"use client";

import { BrowserProvider, Contract, formatEther, parseEther } from "ethers";
import { useEffect, useMemo, useState } from "react";

import { useBondPreview } from "./useBondPreview";
import { useWallet } from "./useWallet";
import {
  ASSET_ADDRESS,
  CHAIN_A,
  CHAIN_B,
  EXPLORER_TX_URL,
  HUB_ABI,
  HUB_ADDRESS,
  VAULT_A_ADDRESS,
  VAULT_B_ADDRESS,
  getHubContract,
} from "../lib/contracts";
import { addTxRecord } from "../lib/tx-history";
import { useToast } from "../providers/ToastProvider";

export const INTEREST_BPS = 100;
export const HUB_FEE_BUFFER = parseEther("0.01");
export const FEE_BUDGET_A = parseEther("0.05");
export const FEE_BUDGET_B = parseEther("0.05");
export const MOCK_LIQUIDITY_A = "50,000 DOT";
export const MOCK_LIQUIDITY_B = "42,000 DOT";
export const MAX_LIQUIDITY_A = "50000";
export const MAX_LIQUIDITY_B = "42000";
export const INTEREST_LABEL = `${(INTEREST_BPS / 100).toFixed(2)}% (${INTEREST_BPS} bps)`;
export const AMOUNT_PRESETS = ["100", "500", "1000", "5000"] as const;
export const DURATION_PRESETS = ["15", "30", "60", "120"] as const;

interface EthereumWindow extends Window {
  ethereum?: unknown;
}

export function toAmount(raw: string): bigint {
  if (!raw) return 0n;
  try {
    return parseEther(raw);
  } catch {
    return 0n;
  }
}

export function formatDot(value: bigint): string {
  return `${Number(formatEther(value)).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  })} DOT`;
}

function humanizeError(rawError: unknown): string {
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
}

export interface CreateLoanState {
  includeA: boolean;
  includeB: boolean;
  amountA: string;
  amountB: string;
  durationMinutes: string;
  amountABigint: bigint;
  amountBBigint: bigint;
  isInvalidA: boolean;
  isInvalidB: boolean;
  preview: ReturnType<typeof useBondPreview>;
  gasEstimate: string | null;
  gasEstimateUnable: boolean;
  submitting: boolean;
  message: string | null;
  error: string | null;
  createdLoanId: string | null;
  createdTxHash: string | null;
  submittedBondAmount: bigint | null;
  canSubmit: boolean;
  canProceedToStep2: boolean;
  canProceedToStep3: boolean;
  setIncludeA: (v: boolean) => void;
  setIncludeB: (v: boolean) => void;
  setAmountA: (v: string) => void;
  setAmountB: (v: string) => void;
  setDurationMinutes: (v: string) => void;
  onSubmit: () => Promise<void>;
}

export function useCreateLoan(): CreateLoanState {
  const { isConnected, isCorrectNetwork } = useWallet();
  const { showToast } = useToast();

  const [includeA, setIncludeA] = useState(true);
  const [includeB, setIncludeB] = useState(true);
  const [amountA, setAmountA] = useState("1000");
  const [amountB, setAmountB] = useState("2000");
  const [durationMinutes, setDurationMinutes] = useState("60");
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
        const gasUnits = await (hub as any).createLoan.estimateGas(params, legs) as bigint; // eslint-disable-line @typescript-eslint/no-explicit-any
        const feeData = await provider.getFeeData();
        const gasPrice = feeData.gasPrice ?? 1_000_000_000n;
        const costWei = gasUnits * gasPrice;
        if (!cancelled) { setGasEstimate(formatDot(costWei)); setGasEstimateUnable(false); }
      } catch {
        if (!cancelled) { setGasEstimate(null); setGasEstimateUnable(true); }
      }
    }, 600);
    return () => { cancelled = true; clearTimeout(timer); };
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

  const canProceedToStep2 = includeA || includeB;
  const canProceedToStep3 =
    canProceedToStep2 &&
    (includeA ? amountABigint > 0n && !isInvalidA : true) &&
    (includeB ? amountBBigint > 0n && !isInvalidB : true);

  const onSubmit = async (): Promise<void> => {
    if (!canSubmit) return;
    const ethereum = (window as EthereumWindow).ethereum;
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
      const legs: Array<{ chain: string; vault: string; amount: bigint; feeBudget: bigint; legInterestBps: number }> = [];
      if (includeA) legs.push({ chain: CHAIN_A, vault: VAULT_A_ADDRESS, amount: amountABigint, feeBudget: FEE_BUDGET_A, legInterestBps: INTEREST_BPS });
      if (includeB) legs.push({ chain: CHAIN_B, vault: VAULT_B_ADDRESS, amount: amountBBigint, feeBudget: FEE_BUDGET_B, legInterestBps: INTEREST_BPS });
      const params = { asset: ASSET_ADDRESS, targetAmount: preview.targetAmount, interestBps: INTEREST_BPS, expiryAt };
      const tx = await hub.createLoan(params, legs);
      const receipt = await tx.wait();
      const txHash = (receipt as { hash?: string }).hash ?? null;
      let nextLoanId: string | null = null;
      for (const log of receipt.logs ?? []) {
        try {
          const parsed = hub.interface.parseLog(log);
          if (parsed?.name === "LoanCreated" && parsed.args[0]) { nextLoanId = parsed.args[0].toString(); break; }
        } catch { /* skip */ }
      }
      setCreatedLoanId(nextLoanId);
      setCreatedTxHash(txHash);
      if (txHash) {
        addTxRecord({ label: nextLoanId ? `Create Loan #${nextLoanId}` : "Create Loan", txHash, status: "confirmed", timestamp: Math.floor(Date.now() / 1000), explorerUrl: EXPLORER_TX_URL(txHash) });
      }
      setMessage("Loan created successfully. Bond lock transaction confirmed.");
      showToast({ tone: "success", title: nextLoanId ? `Loan #${nextLoanId} created` : "Loan created", description: `Bond locked: ${formatDot(preview.totalBond)}`, ...(txHash ? { link: { href: EXPLORER_TX_URL(txHash), label: "View on Explorer" } } : {}) });
    } catch (submitError) {
      const userMessage = humanizeError(submitError);
      setError(userMessage);
      showToast({ tone: "error", title: "Loan creation failed", description: userMessage });
    } finally {
      setSubmitting(false);
    }
  };

  return {
    includeA, includeB, amountA, amountB, durationMinutes,
    amountABigint, amountBBigint, isInvalidA, isInvalidB, preview,
    gasEstimate, gasEstimateUnable, submitting, message, error,
    createdLoanId, createdTxHash, submittedBondAmount,
    canSubmit, canProceedToStep2, canProceedToStep3,
    setIncludeA, setIncludeB, setAmountA, setAmountB, setDurationMinutes,
    onSubmit,
  };
}
