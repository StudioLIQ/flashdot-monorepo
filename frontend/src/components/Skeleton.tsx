"use client";

interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  className?: string;
}

export function Skeleton({ width = "100%", height = "1rem", className }: SkeletonProps): JSX.Element {
  return (
    <div
      aria-hidden
      className={`skeleton-shimmer rounded-lg bg-ink/10 dark:bg-white/8 ${className ?? ""}`}
      style={{ width, height }}
    />
  );
}

/** KPI card skeleton that matches the actual KpiCard layout */
export function KpiCardSkeleton(): JSX.Element {
  return (
    <div aria-hidden className="elevation-1 rounded-2xl p-4">
      {/* Icon + label row */}
      <div className="flex items-center gap-2.5">
        <div className="skeleton-shimmer h-[18px] w-[18px] rounded-md bg-ink/10 dark:bg-white/8" />
        <div className="skeleton-shimmer h-3 w-24 rounded bg-ink/10 dark:bg-white/8" />
      </div>
      {/* Value */}
      <div className="skeleton-shimmer mt-3 h-7 w-32 rounded-lg bg-ink/10 dark:bg-white/8" />
      {/* Sub */}
      <div className="skeleton-shimmer mt-1.5 h-3 w-28 rounded bg-ink/10 dark:bg-white/8" />
    </div>
  );
}

/** Loan card skeleton that matches the actual LoanCard layout */
export function LoanCardSkeleton(): JSX.Element {
  return (
    <div aria-hidden className="rounded-2xl border border-ink/10 bg-white/80 p-4 dark:border-white/10 dark:bg-white/5">
      {/* Top row: loan id + status badge */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="skeleton-shimmer h-4 w-4 rounded bg-ink/10 dark:bg-white/8" />
          <div className="skeleton-shimmer h-4 w-20 rounded bg-ink/10 dark:bg-white/8" />
        </div>
        <div className="skeleton-shimmer h-5 w-24 rounded-full bg-ink/10 dark:bg-white/8" />
      </div>
      {/* Bond + time */}
      <div className="mt-2 flex items-center justify-between gap-3">
        <div>
          <div className="skeleton-shimmer h-4 w-28 rounded bg-ink/10 dark:bg-white/8" />
          <div className="skeleton-shimmer mt-1 h-3 w-16 rounded bg-ink/10 dark:bg-white/8" />
        </div>
        <div className="skeleton-shimmer h-3 w-14 rounded bg-ink/10 dark:bg-white/8" />
      </div>
      {/* Progress bar */}
      <div className="mt-3 h-1.5 rounded-full bg-ink/10 dark:bg-white/10" />
      {/* Health bar */}
      <div className="mt-1.5 h-1 rounded-full bg-ink/8 dark:bg-white/8" />
    </div>
  );
}
