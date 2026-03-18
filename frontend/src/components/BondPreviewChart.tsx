"use client";

import { formatEther } from "ethers";
import { useState } from "react";

import { Tooltip } from "./Tooltip";

interface BondPreviewChartProps {
  repayA: bigint;
  repayB: bigint;
  feeBudgets: bigint;
  hubBuffer: bigint;
  totalBond: bigint;
  /** Total principal being borrowed (for Bond-to-Loan ratio) */
  targetAmount?: bigint;
}

interface Segment {
  key: string;
  label: string;
  description: string;
  value: bigint;
  color: string;
  dotClass: string;
}

function formatDot(value: bigint): string {
  return `${Number(formatEther(value)).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  })} DOT`;
}

function toPercent(value: bigint, total: bigint): number {
  if (total <= 0n) return 0;
  return Number((value * 10_000n) / total) / 100;
}

// SVG donut chart constants
const CX = 50;
const CY = 50;
const R = 34;
const STROKE_WIDTH = 18;
const CIRCUMFERENCE = 2 * Math.PI * R;
const GAP = 1.5; // gap between segments in SVG units

interface ArcSegment extends Segment {
  dashLen: number;
  dashOffset: number;
  pct: number;
}

function computeArcs(segments: Segment[], total: bigint): ArcSegment[] {
  if (total === 0n) return [];
  let accumulated = 0;
  return segments.map((seg) => {
    const pct = toPercent(seg.value, total);
    const rawLen = (pct / 100) * CIRCUMFERENCE;
    const dashLen = Math.max(0, rawLen - GAP);
    const dashOffset = -(accumulated / 100) * CIRCUMFERENCE;
    accumulated += pct;
    return { ...seg, dashLen, dashOffset, pct };
  });
}

export function BondPreviewChart({
  repayA,
  repayB,
  feeBudgets,
  hubBuffer,
  totalBond,
  targetAmount,
}: BondPreviewChartProps): JSX.Element {
  const [hovered, setHovered] = useState<string | null>(null);

  const segments: Segment[] = [
    {
      key: "repay-a",
      label: "Repay A",
      description: "Expected repayment for Parachain Alpha leg.",
      value: repayA,
      color: "#42db8d",
      dotClass: "bg-success",
    },
    {
      key: "repay-b",
      label: "Repay B",
      description: "Expected repayment for Parachain Beta leg.",
      value: repayB,
      color: "#60a5fa",
      dotClass: "bg-info",
    },
    {
      key: "fees",
      label: "Fee Budgets",
      description: "Execution fees reserved for cross-chain messages.",
      value: feeBudgets,
      color: "#f5ad32",
      dotClass: "bg-warning",
    },
    {
      key: "buffer",
      label: "Hub Buffer",
      description: "Extra fee buffer reserved on Hub.",
      value: hubBuffer,
      color: "#94a3b8",
      dotClass: "bg-ink/35 dark:bg-white/35",
    },
  ];

  const arcs = computeArcs(segments, totalBond);
  const hoveredSegment = hovered ? arcs.find((a) => a.key === hovered) : null;

  // Bond-to-Loan ratio
  const bondToLoanPct =
    targetAmount && targetAmount > 0n
      ? (Number((totalBond * 10_000n) / targetAmount) / 100).toFixed(1)
      : null;

  return (
    <div className="mt-6 rounded-xl border border-ink/15 bg-surface p-4 text-sm dark:border-white/10 dark:bg-surface-dark">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-ink/65 dark:text-white/65">
        Estimated Bond Breakdown
        <Tooltip
          content="A bond is a deposit locked as collateral. It's returned on successful repayment, or used to pay vaults if you default."
          icon
        />
      </p>

      <div className="mt-3 flex flex-col items-center gap-4 sm:flex-row">
        {/* Donut SVG */}
        <div className="relative shrink-0">
          <svg
            viewBox="0 0 100 100"
            width={160}
            height={160}
            className="overflow-visible"
            role="img"
            aria-label={`Bond breakdown donut chart. Total: ${formatDot(totalBond)}`}
          >
            {/* Background ring */}
            <circle
              cx={CX}
              cy={CY}
              r={R}
              fill="none"
              stroke="currentColor"
              strokeWidth={STROKE_WIDTH}
              className="text-ink/8 dark:text-white/8"
            />

            {totalBond === 0n ? (
              <circle
                cx={CX}
                cy={CY}
                r={R}
                fill="none"
                stroke="currentColor"
                strokeWidth={STROKE_WIDTH}
                strokeDasharray={`${CIRCUMFERENCE * 0.25} ${CIRCUMFERENCE}`}
                strokeDashoffset={0}
                className="text-ink/15 dark:text-white/15"
                transform={`rotate(-90 ${CX} ${CY})`}
              />
            ) : (
              arcs.map((arc) => (
                <circle
                  key={arc.key}
                  cx={CX}
                  cy={CY}
                  r={R}
                  fill="none"
                  stroke={arc.color}
                  strokeWidth={hovered === arc.key ? STROKE_WIDTH + 2 : STROKE_WIDTH}
                  strokeDasharray={`${arc.dashLen} ${CIRCUMFERENCE}`}
                  strokeDashoffset={arc.dashOffset}
                  strokeLinecap="round"
                  transform={`rotate(-90 ${CX} ${CY})`}
                  style={{
                    transition: "stroke-width 120ms ease, opacity 120ms ease",
                    opacity: hovered && hovered !== arc.key ? 0.45 : 1,
                    cursor: "pointer",
                  }}
                  onMouseEnter={() => setHovered(arc.key)}
                  onMouseLeave={() => setHovered(null)}
                  onFocus={() => setHovered(arc.key)}
                  onBlur={() => setHovered(null)}
                  aria-label={`${arc.label}: ${formatDot(arc.value)} (${arc.pct.toFixed(1)}%)`}
                  tabIndex={0}
                />
              ))
            )}
          </svg>

          {/* Center label */}
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
            {hoveredSegment ? (
              <>
                <p className="text-[10px] font-medium text-ink/60 dark:text-white/55">
                  {hoveredSegment.label}
                </p>
                <p className="font-mono text-xs font-bold">
                  {hoveredSegment.pct.toFixed(1)}%
                </p>
              </>
            ) : (
              <>
                <p className="text-[10px] font-medium text-ink/55 dark:text-white/50">
                  Total Bond
                </p>
                <p className="font-mono text-sm font-bold leading-tight">
                  {totalBond > 0n
                    ? Number(formatEther(totalBond)).toLocaleString(undefined, {
                        maximumFractionDigits: 2,
                      })
                    : "—"}
                </p>
                {totalBond > 0n && (
                  <p className="text-[9px] text-ink/50 dark:text-white/45">DOT</p>
                )}
              </>
            )}
          </div>
        </div>

        {/* Legend + details */}
        <div className="flex-1 space-y-1.5">
          {arcs.map((arc) => (
            <div
              key={arc.key}
              className={`grid cursor-pointer grid-cols-[auto_1fr_auto] items-center gap-2 rounded-lg border px-2.5 py-2 text-xs transition-all ${
                hovered === arc.key
                  ? "border-ink/20 bg-ink/5 dark:border-white/15 dark:bg-white/8"
                  : "border-ink/8 bg-white/40 dark:border-white/8 dark:bg-white/3"
              }`}
              onMouseEnter={() => setHovered(arc.key)}
              onMouseLeave={() => setHovered(null)}
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: arc.color }}
              />
              <p className="min-w-0 truncate font-medium">{arc.label}</p>
              <p className="shrink-0 text-right font-mono text-ink/70 dark:text-white/65">
                {formatDot(arc.value)}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Hovered segment description */}
      {hoveredSegment && (
        <p className="mt-2 text-xs text-ink/60 dark:text-white/55">
          {hoveredSegment.description}
        </p>
      )}

      {/* Summary row */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-ink/15 pt-3 dark:border-white/10">
        <div>
          <p className="text-xs text-ink/55 dark:text-white/50">Total Bond Required</p>
          <p className="font-mono text-xl font-bold">{formatDot(totalBond)}</p>
        </div>
        {bondToLoanPct && targetAmount && targetAmount > 0n && (
          <div className="text-right">
            <p className="text-xs text-ink/55 dark:text-white/50">Bond / Loan</p>
            <p
              className={`font-mono text-base font-bold ${
                Number(bondToLoanPct) > 110
                  ? "text-danger"
                  : Number(bondToLoanPct) > 105
                  ? "text-warning"
                  : "text-success"
              }`}
            >
              {bondToLoanPct}%
            </p>
          </div>
        )}
      </div>

      {/* Deposit → Return summary */}
      {targetAmount && targetAmount > 0n && (
        <p className="mt-2 text-xs text-ink/60 dark:text-white/55">
          You deposit{" "}
          <span className="font-semibold text-ink dark:text-white">
            {formatDot(totalBond)}
          </span>{" "}
          →{" "}
          <span className="font-semibold text-success">
            {formatDot(totalBond)}
          </span>{" "}
          returned on success, or slashed to cover vault repayment.
        </p>
      )}
    </div>
  );
}
