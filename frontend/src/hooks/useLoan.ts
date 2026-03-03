"use client";

import { useQuery } from "@tanstack/react-query";

import { getHubReadContract } from "../lib/contracts";
import { LegState, LoanState, type LegView, type LoanView } from "../lib/loan-types";

const TERMINAL_LOAN_STATES = new Set<number>([
  LoanState.Settled,
  LoanState.Defaulted,
  LoanState.Aborted,
]);

function ceilDiv(a: bigint, b: bigint): bigint {
  return (a + b - 1n) / b;
}

function computeRepay(amount: bigint, legBps: number, loanBps: number): bigint {
  const bps = legBps > 0 ? legBps : loanBps;
  return ceilDiv(amount * BigInt(10_000 + bps), 10_000n);
}

async function fetchLoan(loanId: string): Promise<{ loan: LoanView; legs: LegView[] }> {
  const hub = getHubReadContract();

  const [loanRaw, bondRaw, legCountRaw] = await Promise.all([
    hub.getLoan(BigInt(loanId)),
    hub.getBondInfo(BigInt(loanId)),
    hub.getLegCount(BigInt(loanId)),
  ]);

  const legCount = Number(legCountRaw);
  const legs: LegView[] = [];

  for (let legId = 0; legId < legCount; legId += 1) {
    const legRaw = await hub.getLeg(BigInt(loanId), legId);
    const amount = BigInt(legRaw.amount.toString());
    const legInterestBps = Number(legRaw.legInterestBps);

    legs.push({
      loanId,
      legId,
      vault: String(legRaw.vault),
      amount,
      repayAmount: computeRepay(amount, legInterestBps, Number(loanRaw.interestBps)),
      state: Number(legRaw.state),
      expiryAt: Number(loanRaw.expiryAt),
    });
  }

  const loan: LoanView = {
    loanId,
    state: Number(loanRaw.state),
    repayOnlyMode: Boolean(loanRaw.repayOnlyMode),
    expiryAt: Number(loanRaw.expiryAt),
    bondAmount: BigInt(bondRaw.bondAmount.toString()),
    slashedAmount: legs
      .filter((leg) => leg.state === LegState.DefaultPaid)
      .reduce((sum, leg) => sum + leg.repayAmount, 0n),
  };

  return { loan, legs };
}

export function useLoan(loanId: string | null) {
  return useQuery({
    queryKey: ["loan", loanId],
    queryFn: () => fetchLoan(loanId as string),
    enabled: Boolean(loanId),
    staleTime: 3_000,
    refetchInterval: (query) => {
      const state = (query.state.data as { loan?: LoanView } | undefined)?.loan?.state;
      if (state !== undefined && TERMINAL_LOAN_STATES.has(state)) {
        return false;
      }
      return 5_000;
    },
  });
}
