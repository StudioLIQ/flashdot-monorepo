"use client";

import { useQuery } from "@tanstack/react-query";

import { getHubReadContract, type HubLoanCreatedLog } from "../lib/contracts";
import { LoanState, type LoanView } from "../lib/loan-types";

const TERMINAL_STATES = new Set<number>([
  LoanState.Settled,
  LoanState.Defaulted,
  LoanState.Aborted,
]);

async function fetchLoanHistory(account: string): Promise<LoanView[]> {
  const hub = getHubReadContract();
  const logs = await hub.queryFilter(hub.filters.LoanCreated(), 0, "latest");

  const normalized = account.toLowerCase();
  const loanIds = logs
    .filter((log: HubLoanCreatedLog) => {
      const borrower = String(log.args.borrower ?? log.args[1] ?? "").toLowerCase();
      return borrower === normalized;
    })
    .map((log: HubLoanCreatedLog) => String(log.args.loanId ?? log.args[0]))
    .filter((loanId: string, index: number, arr: string[]) => arr.indexOf(loanId) === index);

  const result: LoanView[] = [];

  for (const loanId of loanIds) {
    const [loanRaw, bondRaw] = await Promise.all([
      hub.getLoan(BigInt(loanId)),
      hub.getBondInfo(BigInt(loanId)),
    ]);

    const state = Number(loanRaw.state);
    if (!TERMINAL_STATES.has(state)) continue;

    result.push({
      loanId,
      state,
      repayOnlyMode: Boolean(loanRaw.repayOnlyMode),
      expiryAt: Number(loanRaw.expiryAt),
      bondAmount: BigInt(bondRaw.bondAmount.toString()),
      slashedAmount: 0n,
    });
  }

  return result.sort((a, b) => Number(BigInt(b.loanId) - BigInt(a.loanId)));
}

export function useLoanHistory(account: string | null) {
  return useQuery({
    queryKey: ["loanHistory", account],
    queryFn: () => fetchLoanHistory(account as string),
    enabled: Boolean(account),
    staleTime: 10_000,
    refetchInterval: 10_000,
    refetchIntervalInBackground: false,
  });
}
