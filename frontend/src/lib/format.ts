import { formatEther } from "ethers";

/**
 * Adaptive-precision DOT formatter.
 * - amount >= 1000  → 2 decimal places  (1,234.56 DOT)
 * - amount 1–1000   → 4 decimal places  (45.1234 DOT)
 * - amount < 1      → 4 significant figures (0.001234 DOT)
 * - Optional compact notation: 1K+, 1M+
 */
export function formatAmount(
  value: bigint,
  symbol = "DOT",
  opts: { compact?: boolean } = {}
): string {
  const num = Number(formatEther(value));

  if (opts.compact) {
    if (num >= 1_000_000) {
      return `${(num / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 2 })}M ${symbol}`;
    }
    if (num >= 1_000) {
      return `${(num / 1_000).toLocaleString(undefined, { maximumFractionDigits: 2 })}K ${symbol}`;
    }
  }

  let formatted: string;
  if (num >= 1_000) {
    formatted = num.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  } else if (num >= 1) {
    formatted = num.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    });
  } else if (num > 0) {
    // 4 significant figures for small amounts
    formatted = num.toPrecision(4).replace(/\.?0+$/, "");
  } else {
    formatted = "0";
  }

  return `${formatted} ${symbol}`;
}

/**
 * USD formatter with 2 decimal places.
 * Returns null when price is unavailable.
 */
export function formatUsd(
  value: bigint,
  dotUsdPrice: number | null
): string | null {
  if (!dotUsdPrice) return null;
  const num = Number(formatEther(value));
  const usd = num * dotUsdPrice;

  if (usd >= 1_000_000) {
    return `≈ $${(usd / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 2 })}M`;
  }
  if (usd >= 1_000) {
    return `≈ $${usd.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  }
  return `≈ $${usd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Legacy compact dot formatter used in multiple components.
 * Kept for compatibility; prefer formatAmount() for new code.
 */
export function formatDotCompat(value: bigint): string {
  return `${Number(formatEther(value)).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  })} DOT`;
}

/**
 * Relative time formatter (e.g., "2h left", "30m left", "Expired").
 */
export function formatRelativeTime(expiryAtSeconds: number): string {
  const now = Math.floor(Date.now() / 1000);
  const delta = expiryAtSeconds - now;
  if (delta <= 0) return "Expired";
  if (delta < 60) return `${delta}s left`;
  if (delta < 3600) return `${Math.floor(delta / 60)}m left`;
  return `${Math.floor(delta / 3600)}h left`;
}

/**
 * Returns remaining time as a fraction 0–1 for health gauge calculations.
 * Returns 0 if expired, 1 if full duration remaining.
 */
export function timeHealthFraction(
  expiryAtSeconds: number,
  createdAtSeconds: number
): number {
  const now = Math.floor(Date.now() / 1000);
  const total = expiryAtSeconds - createdAtSeconds;
  if (total <= 0) return 0;
  const remaining = expiryAtSeconds - now;
  return Math.max(0, Math.min(1, remaining / total));
}
