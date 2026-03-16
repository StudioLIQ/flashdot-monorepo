"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { getHubReadContract, type HubLoanCreatedLog } from "../lib/contracts";
import { type LoanView } from "../lib/loan-types";

async function fetchMyLoans(account: string): Promise<LoanView[]> {
  const hub = getHubReadContract();
  const logs = await hub.queryFilter(hub.filters.LoanCreated(), 0, "latest");

  const normalized = account.toLowerCase();
  const myLoanIds = logs
    .filter((log: HubLoanCreatedLog) => {
      const borrower = String(log.args.borrower ?? log.args[1] ?? "").toLowerCase();
      return borrower === normalized;
    })
    .map((log: HubLoanCreatedLog) => String(log.args.loanId ?? log.args[0]))
    .filter((loanId: string, index: number, arr: string[]) => arr.indexOf(loanId) === index);

  const loans: LoanView[] = [];

  for (const loanId of myLoanIds) {
    const [loanRaw, bondRaw] = await Promise.all([
      hub.getLoan(BigInt(loanId)),
      hub.getBondInfo(BigInt(loanId)),
    ]);

    loans.push({
      loanId,
      state: Number(loanRaw.state),
      repayOnlyMode: Boolean(loanRaw.repayOnlyMode),
      expiryAt: Number(loanRaw.expiryAt),
      bondAmount: BigInt(bondRaw.bondAmount.toString()),
      slashedAmount: 0n,
    });
  }

  return loans.sort((a, b) => Number(BigInt(b.loanId) - BigInt(a.loanId)));
}

export function useMyLoans(account: string | null) {
  const queryClient = useQueryClient();

  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ["myLoans"] });
    queryClient.invalidateQueries({ queryKey: ["loan"] });
    queryClient.invalidateQueries({ queryKey: ["loanHistory"] });
  }, [account, queryClient]);

  return useQuery({
    queryKey: ["myLoans", account],
    queryFn: () => fetchMyLoans(account as string),
    enabled: Boolean(account),
    staleTime: 3_000,
    refetchInterval: 5_000,
  });
}
