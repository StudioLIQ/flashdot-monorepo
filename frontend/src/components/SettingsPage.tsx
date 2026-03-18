"use client";

import { CheckCircle2 } from "lucide-react";
import { useState } from "react";

import { HUB_ADDRESS, ASSET_ADDRESS } from "../lib/contracts";
import { useSettings, type AppSettings } from "../providers/SettingsProvider";

function SettingsSection({ title, children }: { title: string; children: React.ReactNode }): JSX.Element {
  return (
    <div className="elevation-1 rounded-2xl p-5">
      <h2 className="type-h3 mb-4 text-ink dark:text-white">{title}</h2>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function SettingsRow({ label, description, children }: {
  label: string;
  description?: string;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{label}</p>
        {description ? (
          <p className="type-caption mt-0.5 text-ink/60 dark:text-white/50">{description}</p>
        ) : null}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function SelectField<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: Array<{ value: T; label: string }>;
}): JSX.Element {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className="rounded-lg border border-ink/20 bg-white px-3 py-1.5 text-sm font-medium dark:border-white/20 dark:bg-slate-900"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

export function SettingsPage(): JSX.Element {
  const { settings, updateSetting, resetOnboarding } = useSettings();
  const [onboardingReset, setOnboardingReset] = useState(false);

  const handleResetOnboarding = (): void => {
    resetOnboarding();
    setOnboardingReset(true);
    setTimeout(() => setOnboardingReset(false), 2000);
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 md:px-6 md:py-8 animate-content-fade">
      <div className="mb-6">
        <h1 className="page-title">Settings</h1>
        <p className="page-subtitle">Customize appearance, network, and display preferences.</p>
      </div>

      <div className="space-y-4">
        {/* Appearance */}
        <SettingsSection title="Appearance">
          <SettingsRow label="Theme" description="Light, dark, or follow system preference.">
            <SelectField<AppSettings["themeMode"]>
              value={settings.themeMode}
              onChange={(v) => updateSetting("themeMode", v)}
              options={[
                { value: "system", label: "System" },
                { value: "light", label: "Light" },
                { value: "dark", label: "Dark" },
              ]}
            />
          </SettingsRow>
        </SettingsSection>

        {/* Network */}
        <SettingsSection title="Network">
          <SettingsRow
            label="Custom RPC URL"
            description="Leave blank to use the default Polkadot Hub testnet endpoint."
          >
            <input
              type="url"
              value={settings.customRpcUrl}
              onChange={(e) => updateSetting("customRpcUrl", e.target.value)}
              placeholder="https://eth-rpc-testnet.polkadot.io"
              className="w-52 rounded-lg border border-ink/20 bg-white px-3 py-1.5 text-xs font-mono dark:border-white/20 dark:bg-slate-900 sm:w-64"
            />
          </SettingsRow>
          <div className="rounded-xl border border-ink/10 bg-ink/3 px-4 py-3 dark:border-white/10 dark:bg-white/3">
            <p className="type-caption text-ink/60 dark:text-white/50 mb-1 font-semibold uppercase tracking-wide">
              Contract Addresses
            </p>
            <div className="space-y-1">
              <p className="font-mono text-xs">
                <span className="text-ink/55 dark:text-white/45">Hub: </span>
                {HUB_ADDRESS || <span className="text-warning">Not configured</span>}
              </p>
              <p className="font-mono text-xs">
                <span className="text-ink/55 dark:text-white/45">Asset: </span>
                {ASSET_ADDRESS || <span className="text-warning">Not configured</span>}
              </p>
            </div>
          </div>
        </SettingsSection>

        {/* Display */}
        <SettingsSection title="Display">
          <SettingsRow label="Currency" description="Currency for USD/fiat value estimates.">
            <SelectField<AppSettings["currency"]>
              value={settings.currency}
              onChange={(v) => updateSetting("currency", v)}
              options={[
                { value: "USD", label: "USD" },
                { value: "EUR", label: "EUR" },
                { value: "KRW", label: "KRW" },
              ]}
            />
          </SettingsRow>
          <SettingsRow label="Toast duration" description="Seconds before notifications auto-dismiss.">
            <SelectField<never>
              value={String(settings.toastDuration) as never}
              onChange={(v) => updateSetting("toastDuration", Number(v))}
              options={[
                { value: "3" as never, label: "3s" },
                { value: "5" as never, label: "5s" },
                { value: "8" as never, label: "8s" },
                { value: "0" as never, label: "Manual" },
              ]}
            />
          </SettingsRow>
        </SettingsSection>

        {/* Advanced */}
        <SettingsSection title="Advanced">
          <SettingsRow label="Gas preference" description="Used when estimating transaction costs.">
            <SelectField<AppSettings["gasPreference"]>
              value={settings.gasPreference}
              onChange={(v) => updateSetting("gasPreference", v)}
              options={[
                { value: "slow", label: "Slow" },
                { value: "standard", label: "Standard" },
                { value: "fast", label: "Fast" },
              ]}
            />
          </SettingsRow>
          <SettingsRow
            label="Replay onboarding tour"
            description="Show the welcome guide again on next wallet connect."
          >
            <button
              type="button"
              onClick={handleResetOnboarding}
              className="inline-flex items-center gap-1.5 rounded-lg border border-ink/20 px-3 py-1.5 text-xs font-semibold transition hover:bg-ink/5 dark:border-white/20 dark:hover:bg-white/8"
            >
              {onboardingReset ? (
                <>
                  <CheckCircle2 size={13} className="text-success" />
                  Reset done
                </>
              ) : (
                "Replay tour"
              )}
            </button>
          </SettingsRow>
        </SettingsSection>

        {/* About */}
        <SettingsSection title="About">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <span className="text-ink/60 dark:text-white/50">Version</span>
              <span className="font-mono font-semibold">v0.1.0-testnet</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-ink/60 dark:text-white/50">Chain</span>
              <span className="font-mono font-semibold">Polkadot Hub EVM Testnet</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-ink/60 dark:text-white/50">GitHub</span>
              <a
                href="https://github.com/flashdot"
                target="_blank"
                rel="noreferrer"
                className="text-primary hover:underline"
              >
                github.com/flashdot
              </a>
            </div>
          </div>
        </SettingsSection>
      </div>
    </main>
  );
}
