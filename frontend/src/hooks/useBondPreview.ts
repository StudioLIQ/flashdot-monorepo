import { useMemo } from "react";

export interface BondPreviewInput {
  amountA: bigint;
  amountB: bigint;
  includeA: boolean;
  includeB: boolean;
  legInterestBps: number;
  feeBudgetA: bigint;
  feeBudgetB: bigint;
  hubFeeBuffer: bigint;
}

export interface BondPreviewResult {
  repayA: bigint;
  repayB: bigint;
  feeBudgets: bigint;
  totalBond: bigint;
  targetAmount: bigint;
}

function ceilDiv(a: bigint, b: bigint): bigint {
  return (a + b - 1n) / b;
}

function calcRepay(principal: bigint, bps: number): bigint {
  if (principal === 0n) return 0n;
  return ceilDiv(principal * BigInt(10_000 + bps), 10_000n);
}

export function useBondPreview(input: BondPreviewInput): BondPreviewResult {
  return useMemo(() => {
    const principalA = input.includeA ? input.amountA : 0n;
    const principalB = input.includeB ? input.amountB : 0n;

    const repayA = calcRepay(principalA, input.legInterestBps);
    const repayB = calcRepay(principalB, input.legInterestBps);

    const feeBudgets = (input.includeA ? input.feeBudgetA : 0n) + (input.includeB ? input.feeBudgetB : 0n);
    const targetAmount = principalA + principalB;
    const totalBond = repayA + repayB + feeBudgets + input.hubFeeBuffer;

    return {
      repayA,
      repayB,
      feeBudgets,
      targetAmount,
      totalBond,
    };
  }, [input]);
}
