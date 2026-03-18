"use client";

import { useMemo } from "react";

interface CircularCountdownProps {
  totalSeconds: number;
  remainingSeconds: number;
  size?: number;
}

function formatCountdown(seconds: number): string {
  if (seconds <= 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function CircularCountdown({
  totalSeconds,
  remainingSeconds,
  size = 72,
}: CircularCountdownProps): JSX.Element {
  const radius = (size - 10) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.max(0, Math.min(1, remainingSeconds / Math.max(1, totalSeconds)));
  const dashOffset = circumference * (1 - progress);

  const { strokeColor, textColor } = useMemo(() => {
    if (remainingSeconds <= 0) return { strokeColor: "#ef4444", textColor: "text-danger" };
    if (remainingSeconds <= 60) return { strokeColor: "#ef4444", textColor: "text-danger" };
    if (remainingSeconds <= 300) return { strokeColor: "#f5ad32", textColor: "text-warning" };
    return { strokeColor: "#42db8d", textColor: "text-success" };
  }, [remainingSeconds]);

  const ringFast = remainingSeconds > 0 && remainingSeconds <= 60;

  return (
    <div className="inline-flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          {/* Track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="5"
            className="text-ink/10 dark:text-white/10"
          />
          {/* Progress arc */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={strokeColor}
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            className={`transition-[stroke-dashoffset] duration-1000 ease-linear ${ringFast ? "animate-pulse" : ""}`}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`font-mono text-xs font-bold tabular-nums ${textColor}`}>
            {formatCountdown(remainingSeconds)}
          </span>
        </div>
      </div>
      <span className="text-[10px] font-semibold text-ink/55 dark:text-white/50">Repay before expiry</span>
    </div>
  );
}
