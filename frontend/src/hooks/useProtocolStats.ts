"use client";

import { useQuery } from "@tanstack/react-query";

import { getHubReadContract } from "../lib/contracts";
import { LoanState } from "../lib/loan-types";

interface ProtocolStats {
  totalLoans: number | null;
  activeLoans: number | null;
  successRate: number | null;
  loading: boolean;
}

async function fetchProtocolStats(): Promise<Omit<ProtocolStats, "loading">> {
  const hub = getHubReadContract();
  const logs = await hub.queryFilter(hub.filters.LoanCreated(), 0, "latest");
  const totalLoans = logs.length;

  if (totalLoans === 0) {
    return { totalLoans: 0, activeLoans: 0, successRate: null };
  }

  // Sample up to 50 most recent loans for stats (avoid O(n) on large datasets)
  const sampleSize = Math.min(totalLoans, 50);
  const sampleIds = logs
    .slice(-sampleSize)
    .map((log) => String(log.args.loanId ?? log.args[0]));

  const loanStates = await Promise.all(
    sampleIds.map((loanId) => hub.getLoan(BigInt(loanId)).then((l) => Number(l.state)).catch(() => -1))
  );

  const activeStates = new Set<number>([
    LoanState.Created,
    LoanState.Preparing,
    LoanState.Prepared,
    LoanState.Committing,
    LoanState.Committed,
    LoanState.Repaying,
    LoanState.Settling,
  ]);
  const active = loanStates.filter((s) => activeStates.has(s)).length;
  const settled = loanStates.filter((s) => s === LoanState.Settled).length;
  const defaulted = loanStates.filter((s) => s === LoanState.Defaulted).length;
  const closed = settled + defaulted;
  const successRate = closed > 0 ? Math.round((settled / closed) * 100) : null;

  // Scale active count to total loans (rough estimate)
  const scaledActive = Math.round((active / sampleSize) * totalLoans);

  return { totalLoans, activeLoans: scaledActive, successRate };
}

export function useProtocolStats(): ProtocolStats {
  const query = useQuery({
    queryKey: ["protocolStats"],
    queryFn: fetchProtocolStats,
    staleTime: 60_000,
    retry: 1,
  });

  if (query.isLoading) {
    return { totalLoans: null, activeLoans: null, successRate: null, loading: true };
  }

  return {
    totalLoans: query.data?.totalLoans ?? null,
    activeLoans: query.data?.activeLoans ?? null,
    successRate: query.data?.successRate ?? null,
    loading: false,
  };
}
