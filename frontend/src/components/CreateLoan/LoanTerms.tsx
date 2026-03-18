"use client";

import { Globe } from "lucide-react";
import { useEffect, useState } from "react";

import { BondPreviewChart } from "../BondPreviewChart";
import {
  DURATION_PRESETS,
  FEE_BUDGET_A,
  FEE_BUDGET_B,
  HUB_FEE_BUFFER,
  INTEREST_LABEL,
  MAX_LIQUIDITY_A,
  MAX_LIQUIDITY_B,
  MOCK_LIQUIDITY_A,
  MOCK_LIQUIDITY_B,
  type CreateLoanState,
} from "../../hooks/useCreateLoan";
import { VAULT_A_ADDRESS, VAULT_B_ADDRESS } from "../../lib/contracts";

// DOT price hook — fetches from CoinGecko, falls back to a reasonable default
function useDotUsdPrice(): number | null {
  const [price, setPrice] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch("https://api.coingecko.com/api/v3/simple/price?ids=polkadot&vs_currencies=usd")
      .then((r) => r.json())
      .then((data: { polkadot?: { usd?: number } }) => {
        if (!cancelled && data?.polkadot?.usd) setPrice(data.polkadot.usd);
      })
      .catch(() => {
        if (!cancelled) setPrice(8.0); // fallback price
      });
    return () => { cancelled = true; };
  }, []);

  return price;
}

function toDisplayValue(raw: string): string {
  if (!raw) return "";
  const num = Number(raw.replace(/,/g, ""));
  if (Number.isNaN(num)) return raw;
  // Don't add commas while typing a decimal
  if (raw.endsWith(".") || raw.endsWith(".0")) return raw;
  const [int, dec] = raw.split(".");
  const intFormatted = Number(int || "0").toLocaleString("en-US");
  return dec !== undefined ? `${intFormatted}.${dec}` : intFormatted;
}

function stripCommas(value: string): string {
  return value.replace(/,/g, "");
}

function shortAddress(address: string): string {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

interface LoanTermsProps
  extends Pick<
    CreateLoanState,
    | "includeA"
    | "includeB"
    | "amountA"
    | "amountB"
    | "amountABigint"
    | "amountBBigint"
    | "isInvalidA"
    | "isInvalidB"
    | "durationMinutes"
    | "setIncludeA"
    | "setIncludeB"
    | "setAmountA"
    | "setAmountB"
    | "setDurationMinutes"
    | "preview"
    | "canProceedToStep3"
  > {
  isGuided: boolean;
  onBack: () => void;
  onNext: () => void;
}

export function LoanTerms({
  includeA,
  includeB,
  amountA,
  amountB,
  isInvalidA,
  isInvalidB,
  durationMinutes,
  setIncludeA,
  setIncludeB,
  setAmountA,
  setAmountB,
  setDurationMinutes,
  preview,
  canProceedToStep3,
  isGuided,
  onBack,
  onNext,
}: LoanTermsProps): JSX.Element {
  const dotPrice = useDotUsdPrice();
  const durationLabel =
    Number(durationMinutes) >= 60
      ? `${(Number(durationMinutes) / 60).toFixed(Number(durationMinutes) % 60 === 0 ? 0 : 1)}h`
      : `${durationMinutes}m`;

  return (
    <>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <VaultAmountCard
          label="Parachain Alpha"
          vaultAddress={VAULT_A_ADDRESS}
          accentClass="primary"
          included={includeA}
          amount={amountA}
          isInvalid={isInvalidA}
          liquidity={MOCK_LIQUIDITY_A}
          maxLiquidity={MAX_LIQUIDITY_A}
          inputId="vault-a-amount"
          dotPrice={dotPrice}
          onToggle={() => setIncludeA(!includeA)}
          onAmountChange={setAmountA}
        />
        <VaultAmountCard
          label="Parachain Beta"
          vaultAddress={VAULT_B_ADDRESS}
          accentClass="info"
          included={includeB}
          amount={amountB}
          isInvalid={isInvalidB}
          liquidity={MOCK_LIQUIDITY_B}
          maxLiquidity={MAX_LIQUIDITY_B}
          inputId="vault-b-amount"
          dotPrice={dotPrice}
          onToggle={() => setIncludeB(!includeB)}
          onAmountChange={setAmountB}
        />
      </div>

      <DurationControl
        durationMinutes={durationMinutes}
        durationLabel={durationLabel}
        onChangeDuration={setDurationMinutes}
      />

      <BondPreviewChart
        repayA={preview.repayA}
        repayB={preview.repayB}
        feeBudgets={preview.feeBudgets}
        hubBuffer={HUB_FEE_BUFFER}
        totalBond={preview.totalBond}
      />

      {isGuided ? (
        <div className="mt-5 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-ink/20 px-5 py-2.5 text-sm font-semibold transition-all hover:bg-ink/5 active:scale-[0.97] dark:border-white/15 dark:hover:bg-white/10"
          >
            ← Back
          </button>
          <button
            type="button"
            onClick={onNext}
            disabled={!canProceedToStep3}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-fg transition-all hover:bg-primary-hover active:scale-[0.97] disabled:cursor-not-allowed disabled:bg-ink/20 disabled:text-ink/50 dark:disabled:bg-white/15 dark:disabled:text-white/35"
          >
            Next →
          </button>
        </div>
      ) : null}
    </>
  );
}

const PERCENT_PRESETS = [
  { label: "25%", pct: 0.25 },
  { label: "50%", pct: 0.50 },
  { label: "75%", pct: 0.75 },
] as const;

interface VaultAmountCardProps {
  label: string;
  vaultAddress: string;
  accentClass: "primary" | "info";
  included: boolean;
  amount: string;
  isInvalid: boolean;
  liquidity: string;
  maxLiquidity: string;
  inputId: string;
  dotPrice: number | null;
  onToggle: () => void;
  onAmountChange: (v: string) => void;
}

function VaultAmountCard({
  label,
  vaultAddress,
  accentClass,
  included,
  amount,
  isInvalid,
  liquidity,
  maxLiquidity,
  inputId,
  dotPrice,
  onToggle,
  onAmountChange,
}: VaultAmountCardProps): JSX.Element {
  const isBorderPrimary = accentClass === "primary";
  const numAmount = Number(amount) || 0;
  const maxLiqNum = Number(maxLiquidity) || 0;
  const exceedsLiquidity = numAmount > maxLiqNum && numAmount > 0;

  const usdEstimate = dotPrice && numAmount > 0
    ? `≈ $${(numAmount * dotPrice).toLocaleString("en-US", { maximumFractionDigits: 0 })} USD`
    : null;

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const raw = stripCommas(e.target.value);
    // Allow digits and a single decimal point
    if (/^[0-9]*\.?[0-9]*$/.test(raw) || raw === "") {
      onAmountChange(raw);
    }
  };

  return (
    <article
      className={`relative overflow-hidden rounded-2xl border transition ${
        included
          ? isBorderPrimary
            ? "border-primary/25 bg-primary/8 shadow-[0_0_0_1px_rgba(66,219,141,0.12)] dark:border-primary/20 dark:bg-primary/12"
            : "border-info/25 bg-info/8 shadow-[0_0_0_1px_rgba(96,165,250,0.12)] dark:border-info/20 dark:bg-info/12"
          : "border-ink/15 bg-white/60 opacity-60 grayscale dark:border-white/10 dark:bg-white/5"
      }`}
    >
      <div
        className={`absolute left-0 top-0 h-full w-1 transition-colors ${
          included ? (isBorderPrimary ? "bg-primary" : "bg-info") : "bg-transparent"
        }`}
      />
      <div className="px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div
              className={`grid h-9 w-9 place-items-center rounded-xl ${
                isBorderPrimary ? "bg-primary/15" : "bg-info/15"
              }`}
            >
              <Globe size={16} className={isBorderPrimary ? "text-primary" : "text-info"} />
            </div>
            <div>
              <p className="text-sm font-semibold">{label}</p>
              {vaultAddress ? (
                <p className="font-mono text-[10px] text-ink/50 dark:text-white/45">
                  {shortAddress(vaultAddress)}
                </p>
              ) : null}
            </div>
          </div>
          <label
            className="relative inline-flex cursor-pointer items-center"
            aria-label={`Include ${label}`}
          >
            <input
              type="checkbox"
              checked={included}
              onChange={onToggle}
              className="peer sr-only"
            />
            <div
              className={`peer h-5 w-9 rounded-full transition-colors ${
                isBorderPrimary
                  ? "bg-ink/20 dark:bg-white/20 peer-checked:bg-primary"
                  : "bg-ink/20 dark:bg-white/20 peer-checked:bg-info"
              }`}
            />
            <span className="absolute left-0.5 h-4 w-4 transform rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
          </label>
        </div>

        <div className="mt-3 flex gap-4 text-xs">
          <div>
            <p className="text-ink/55 dark:text-white/50">Liquidity</p>
            <p className="mt-0.5 font-semibold">{liquidity}</p>
          </div>
          <div>
            <p className="text-ink/55 dark:text-white/50">Interest</p>
            <p className="mt-0.5 font-semibold">{INTEREST_LABEL}</p>
          </div>
        </div>

        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.08em] text-ink/65 dark:text-white/60">
              Amount (DOT)
            </span>
          </div>
          <div
            className={`flex items-center rounded-xl border bg-white px-4 py-3 dark:bg-slate-900 ${
              isInvalid || exceedsLiquidity ? "border-danger" : "border-ink/20 dark:border-white/15"
            }`}
          >
            <input
              id={inputId}
              type="text"
              inputMode="decimal"
              value={toDisplayValue(amount)}
              onChange={handleInput}
              aria-label={`${label} amount in DOT`}
              aria-invalid={isInvalid || exceedsLiquidity}
              aria-describedby={`${inputId}-error`}
              className="w-full bg-transparent font-mono text-2xl font-semibold text-right outline-none"
              placeholder="0"
            />
            <span className="ml-2 text-sm font-semibold text-ink/50 dark:text-white/45">DOT</span>
          </div>

          {/* USD estimate */}
          {usdEstimate && !isInvalid && !exceedsLiquidity ? (
            <p className="mt-1 text-right text-xs text-ink/50 dark:text-white/40">
              {usdEstimate}
            </p>
          ) : null}

          {/* Error messages */}
          {isInvalid ? (
            <p id={`${inputId}-error`} role="alert" className="mt-1 text-xs text-danger">
              Invalid amount
            </p>
          ) : exceedsLiquidity ? (
            <p id={`${inputId}-error`} role="alert" className="mt-1 text-xs text-danger">
              Exceeds available vault liquidity ({liquidity})
            </p>
          ) : (
            <p className="mt-1 text-right text-xs text-ink/55 dark:text-white/50">
              Available: {liquidity}
            </p>
          )}
        </div>

        {/* Percent-based presets */}
        <div className="mt-2 flex flex-wrap gap-1.5">
          {PERCENT_PRESETS.map(({ label: pLabel, pct }) => {
            const presetVal = String(Math.floor(maxLiqNum * pct));
            return (
              <button
                key={pLabel}
                type="button"
                onClick={() => onAmountChange(presetVal)}
                className={`min-h-8 rounded-lg border px-2.5 py-1 text-xs font-semibold ${
                  amount === presetVal
                    ? isBorderPrimary
                      ? "border-primary/50 bg-primary/15"
                      : "border-info/50 bg-info/15"
                    : "border-ink/20 hover:bg-ink/5 dark:border-white/20 dark:hover:bg-white/10"
                }`}
              >
                {pLabel}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => onAmountChange(maxLiquidity)}
            className={`min-h-8 rounded-lg border px-2.5 py-1 text-xs font-bold ${
              amount === maxLiquidity
                ? isBorderPrimary
                  ? "border-primary/50 bg-primary/15"
                  : "border-info/50 bg-info/15"
                : "border-ink/20 hover:bg-ink/5 dark:border-white/20 dark:hover:bg-white/10"
            }`}
          >
            MAX
          </button>
        </div>
      </div>
    </article>
  );
}

interface DurationControlProps {
  durationMinutes: string;
  durationLabel: string;
  onChangeDuration: (v: string) => void;
}

function DurationControl({
  durationMinutes,
  durationLabel,
  onChangeDuration,
}: DurationControlProps): JSX.Element {
  const expiryDate = new Date(
    Date.now() + (Number(durationMinutes) || 60) * 60 * 1000
  );
  const isDangerous = Number(durationMinutes) < 15;

  return (
    <div className="mt-4 rounded-xl border border-ink/15 bg-surface p-4 dark:border-white/10 dark:bg-surface-dark">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor="loan-duration-minutes" className="text-sm font-medium">
          Duration
        </label>
        <span className="font-mono text-sm font-semibold">{durationLabel}</span>
      </div>
      <input
        id="loan-duration-minutes"
        type="range"
        min={5}
        max={180}
        step={5}
        value={Number(durationMinutes) || 60}
        onChange={(e) => onChangeDuration(e.target.value)}
        aria-label="Loan duration in minutes"
        className={`mt-3 h-2 w-full cursor-pointer appearance-none rounded-full outline-none ${
          isDangerous
            ? "[&::-webkit-slider-runnable-track]:bg-danger/30 [&::-webkit-slider-thumb]:bg-danger"
            : "[&::-webkit-slider-runnable-track]:bg-ink/15 [&::-webkit-slider-thumb]:bg-primary dark:[&::-webkit-slider-runnable-track]:bg-white/15"
        } [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-sm`}
      />
      {isDangerous ? (
        <p className="mt-1 text-xs font-semibold text-danger">
          Warning: durations under 15 min are high-risk. You may not have time to repay.
        </p>
      ) : null}
      <p className="mt-2 font-mono text-xs text-ink/60 dark:text-white/55">
        Expires at:{" "}
        {expiryDate.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}{" "}
        ({expiryDate.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })})
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {DURATION_PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => onChangeDuration(preset)}
            className={`rounded-full border px-3 py-1 text-xs font-semibold ${
              durationMinutes === preset
                ? "border-primary/50 bg-primary/15 text-ink dark:text-white"
                : "border-ink/20 hover:bg-ink/5 dark:border-white/20 dark:hover:bg-white/10"
            }`}
          >
            {Number(preset) >= 60 ? `${Number(preset) / 60}hr` : `${preset}min`}
          </button>
        ))}
      </div>
    </div>
  );
}
