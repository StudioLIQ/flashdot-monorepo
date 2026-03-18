import { useEffect, useMemo, useState } from "react";

interface RepayOnlyBannerProps {
  committedLegs: number;
  totalLegs: number;
  expiryAt: number;
}

function formatRemaining(seconds: number): string {
  if (seconds <= 0) return "expired";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  if (h > 0) return `${h}h ${m}m ${s}s`;
  return `${m}m ${s}s`;
}

export function RepayOnlyBanner({ committedLegs, totalLegs, expiryAt }: RepayOnlyBannerProps): JSX.Element {
  const [nowSec, setNowSec] = useState(Math.floor(Date.now() / 1000));

  useEffect(() => {
    const timer = setInterval(() => setNowSec(Math.floor(Date.now() / 1000)), 1_000);
    return () => clearInterval(timer);
  }, []);

  const timeRemaining = useMemo(() => formatRemaining(expiryAt - nowSec), [expiryAt, nowSec]);

  return (
    <div className="rounded-xl border border-danger/45 bg-danger/10 px-4 py-4 text-sm dark:border-danger/40 dark:bg-danger/20">
      <p className="text-base font-semibold text-danger">⚠️ Partial Commit Failure</p>
      <p className="mt-2 text-danger">
        Some vaults failed to commit. Additional commits are blocked and only committed legs can be repaid.
      </p>
      <div className="mt-3">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-danger/90">What to do</p>
        <p className="mt-1 text-danger">• Repay all committed legs before expiry.</p>
        <p className="text-danger">• If unpaid, your bond will cover outstanding obligations.</p>
      </div>
      <p className="mt-3 text-xs font-semibold uppercase tracking-[0.08em] text-danger/90">
        Committed legs: {committedLegs} of {totalLegs} | Time remaining: {timeRemaining}
      </p>
    </div>
  );
}
