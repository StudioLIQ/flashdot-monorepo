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
      className={`animate-pulse rounded-lg bg-ink/10 dark:bg-white/10 ${className ?? ""}`}
      style={{ width, height }}
    />
  );
}
