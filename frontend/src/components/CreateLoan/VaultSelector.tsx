"use client";

import { Globe } from "lucide-react";

import {
  INTEREST_LABEL,
  MOCK_LIQUIDITY_A,
  MOCK_LIQUIDITY_B,
} from "../../hooks/useCreateLoan";

interface VaultSelectorProps {
  includeA: boolean;
  includeB: boolean;
  onToggleA: () => void;
  onToggleB: () => void;
  canProceed: boolean;
  onNext: () => void;
}

interface VaultCardProps {
  label: string;
  liquidity: string;
  included: boolean;
  accentClass: string;
  onToggle: () => void;
}

function VaultCard({
  label,
  liquidity,
  included,
  accentClass,
  onToggle,
}: VaultCardProps): JSX.Element {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`relative overflow-hidden rounded-2xl border p-4 text-left transition ${
        included
          ? `${accentClass}`
          : "border-ink/15 bg-white/60 opacity-55 dark:border-white/10 dark:bg-white/5"
      }`}
    >
      <div
        className={`absolute left-0 top-0 h-full w-1 transition-colors ${
          included ? (accentClass.includes("primary") ? "bg-primary" : "bg-info") : "bg-transparent"
        }`}
      />
      <div className="pl-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div
              className={`grid h-8 w-8 place-items-center rounded-xl ${
                accentClass.includes("primary") ? "bg-primary/15" : "bg-info/15"
              }`}
            >
              <Globe
                size={14}
                className={accentClass.includes("primary") ? "text-primary" : "text-info"}
              />
            </div>
            <p className="text-sm font-semibold">{label}</p>
          </div>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
              included
                ? accentClass.includes("primary")
                  ? "bg-primary/20 text-primary"
                  : "bg-info/20 text-info"
                : "bg-ink/10 text-ink/40 dark:bg-white/10 dark:text-white/35"
            }`}
          >
            {included ? "✓ Selected" : "Not selected"}
          </span>
        </div>
        <div className="mt-2 flex gap-4 text-xs text-ink/60 dark:text-white/55">
          <span>Liquidity: {liquidity}</span>
          <span>Interest: {INTEREST_LABEL}</span>
        </div>
      </div>
    </button>
  );
}

export function VaultSelector({
  includeA,
  includeB,
  onToggleA,
  onToggleB,
  canProceed,
  onNext,
}: VaultSelectorProps): JSX.Element {
  return (
    <div className="mt-5">
      <div className="grid gap-3 md:grid-cols-2">
        <VaultCard
          label="Parachain Alpha"
          liquidity={MOCK_LIQUIDITY_A}
          included={includeA}
          accentClass="border-primary/25 bg-primary/8 dark:border-primary/20 dark:bg-primary/12"
          onToggle={onToggleA}
        />
        <VaultCard
          label="Parachain Beta"
          liquidity={MOCK_LIQUIDITY_B}
          included={includeB}
          accentClass="border-info/25 bg-info/8 dark:border-info/20 dark:bg-info/12"
          onToggle={onToggleB}
        />
        {!canProceed ? (
          <p className="col-span-full text-xs text-danger">
            Select at least one vault to continue.
          </p>
        ) : null}
      </div>
      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={onNext}
          disabled={!canProceed}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-fg transition-all hover:bg-primary-hover active:scale-[0.97] disabled:cursor-not-allowed disabled:bg-ink/20 disabled:text-ink/50 dark:disabled:bg-white/15 dark:disabled:text-white/35"
        >
          Next →
        </button>
      </div>
    </div>
  );
}
