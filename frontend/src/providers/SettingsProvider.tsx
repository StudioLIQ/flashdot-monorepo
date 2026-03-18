"use client";

import { createContext, PropsWithChildren, useCallback, useContext, useMemo, useState } from "react";

import { clearOnboardingCompleted } from "../components/OnboardingModal";

export type ThemeMode = "system" | "light" | "dark";
export type CurrencyUnit = "USD" | "EUR" | "KRW";
export type GasPreference = "slow" | "standard" | "fast";

export interface AppSettings {
  themeMode: ThemeMode;
  currency: CurrencyUnit;
  customRpcUrl: string;
  gasPreference: GasPreference;
  toastDuration: number; // seconds
}

const DEFAULTS: AppSettings = {
  themeMode: "system",
  currency: "USD",
  customRpcUrl: "",
  gasPreference: "standard",
  toastDuration: 5,
};

const STORAGE_KEY = "flashdot_settings";

function loadSettings(): AppSettings {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<AppSettings>) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

function saveSettings(s: AppSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    // localStorage unavailable
  }
}

interface SettingsContextValue {
  settings: AppSettings;
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  resetOnboarding: () => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: PropsWithChildren): JSX.Element {
  const [settings, setSettings] = useState<AppSettings>(loadSettings);

  const updateSetting = useCallback(<K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: value };
      saveSettings(next);
      return next;
    });
  }, []);

  const resetOnboarding = useCallback(() => {
    clearOnboardingCompleted();
  }, []);

  const value = useMemo<SettingsContextValue>(
    () => ({ settings, updateSetting, resetOnboarding }),
    [settings, updateSetting, resetOnboarding]
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used inside SettingsProvider");
  return ctx;
}
