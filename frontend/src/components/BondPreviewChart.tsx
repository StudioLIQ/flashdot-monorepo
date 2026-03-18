"use client";

import { formatEther } from "ethers";

import { Tooltip } from "./Tooltip";

interface BondPreviewChartProps {
  repayA: bigint;
  repayB: bigint;
  feeBudgets: bigint;
  hubBuffer: bigint;
  totalBond: bigint;
}

interface BondSegment {
  key: string;
  label: string;
  description: string;
  value: bigint;
  tone: string;
}

function formatDot(value: bigint): string {
  return `${Number(formatEther(value)).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  })} DOT`;
}

function toPercent(value: bigint, total: bigint): number {
  if (total <= 0n) return 0;
  return Number((value * 10_000n) / total) / 100;
}

export function BondPreviewChart({
  repayA,
  repayB,
  feeBudgets,
  hubBuffer,
  totalBond,
}: BondPreviewChartProps): JSX.Element {
  const segments: BondSegment[] = [
    {
      key: "repay-a",
      label: "Repay A",
      description: "Expected repayment for Parachain Alpha leg.",
      value: repayA,
      tone: "bg-success",
    },
    {
      key: "repay-b",
      label: "Repay B",
      description: "Expected repayment for Parachain Beta leg.",
      value: repayB,
      tone: "bg-success/65",
    },
    {
      key: "fees",
      label: "Fee Budgets",
      description: "Execution fees reserved for cross-chain messages.",
      value: feeBudgets,
      tone: "bg-warning",
    },
    {
      key: "buffer",
      label: "Hub Buffer",
      description: "Extra fee buffer reserved on Hub.",
      value: hubBuffer,
      tone: "bg-ink/35 dark:bg-white/35",
    },
  ];

  return (
    <div className="mt-6 rounded-xl border border-ink/15 bg-surface p-4 text-sm dark:border-white/10 dark:bg-surface-dark">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-ink/65 dark:text-white/65">
        Estimated Bond Breakdown
        <Tooltip
          content="A bond is a deposit locked as collateral. It's returned on successful repayment, or used to pay vaults if you default."
          icon
        />
      </p>
      <div className="mt-3 flex h-4 overflow-hidden rounded-full border border-ink/10 bg-white/60 dark:border-white/10 dark:bg-white/10">
        {segments.map((segment) => (
          <div
            key={segment.key}
            title={`${segment.label}: ${segment.description}`}
            className={`${segment.tone} h-full shrink-0 transition-opacity hover:opacity-85`}
            style={{ width: `${toPercent(segment.value, totalBond)}%` }}
          />
        ))}
      </div>

      <div className="mt-4 grid gap-2">
        {segments.map((segment) => {
          const percent = toPercent(segment.value, totalBond);
          return (
            <div
              key={segment.key}
              title={segment.description}
              className="grid grid-cols-[auto_1fr_auto] items-center gap-2 rounded-lg border border-ink/10 bg-white/55 px-2.5 py-2 text-xs dark:border-white/10 dark:bg-white/5"
            >
              <span className={`h-2.5 w-2.5 rounded-full ${segment.tone}`} />
              <p className="font-medium">{segment.label}</p>
              <p className="text-right font-mono text-ink/75 dark:text-white/75">
                {formatDot(segment.value)} ({percent.toFixed(2)}%)
              </p>
            </div>
          );
        })}
      </div>

      <p className="mt-4 border-t border-ink/20 pt-3 text-xl font-bold dark:border-white/10">
        Total Bond Required: <span className="font-mono">{formatDot(totalBond)}</span>
      </p>
    </div>
  );
}
