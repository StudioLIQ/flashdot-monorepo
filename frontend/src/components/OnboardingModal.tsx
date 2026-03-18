"use client";

import { Activity, CheckCircle2, PlusCircle, Zap } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

const STORAGE_KEY = "flashdot_onboarding_completed";

export function getOnboardingCompleted(): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(STORAGE_KEY) === "true";
}

export function setOnboardingCompleted(): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, "true");
}

export function clearOnboardingCompleted(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}

const STEPS = [
  {
    icon: <CheckCircle2 size={20} className="text-success" />,
    title: "Your Dashboard",
    desc: "See locked bond totals, active loan counts, and success rate at a glance.",
  },
  {
    icon: <PlusCircle size={20} className="text-primary" />,
    title: "Create a Flash Loan",
    desc: "Select vault chains, set amounts and duration, then sign one transaction to lock your bond.",
  },
  {
    icon: <Activity size={20} className="text-info" />,
    title: "Track in Real Time",
    desc: "Monitor each leg's XCM progress — from Prepare to Commit to Repay — with live status updates.",
  },
] as const;

interface OnboardingModalProps {
  onComplete: () => void;
}

function OnboardingModal({ onComplete }: OnboardingModalProps): JSX.Element {
  const [step, setStep] = useState(0);

  const handleDone = (): void => {
    setOnboardingCompleted();
    onComplete();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={handleDone}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className="elevation-3 relative w-full max-w-md rounded-2xl p-6">
        {/* Header */}
        <div className="mb-5 flex items-center gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/15">
            <Zap size={20} className="text-primary" />
          </div>
          <div>
            <h2 id="onboarding-title" className="text-base font-bold">
              Welcome to FlashDot
            </h2>
            <p className="text-xs text-ink/60 dark:text-white/50">
              Quick tour — {STEPS.length} things to know
            </p>
          </div>
        </div>

        {/* Step indicator */}
        <div className="mb-5 flex gap-1.5">
          {STEPS.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setStep(i)}
              aria-label={`Go to step ${i + 1}`}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                i <= step ? "bg-primary" : "bg-ink/15 dark:bg-white/15"
              }`}
            />
          ))}
        </div>

        {/* Current step */}
        <div className="min-h-[80px]">
          {STEPS[step] ? (
            <div className="flex items-start gap-3">
              <div className="mt-0.5 shrink-0">{STEPS[step].icon}</div>
              <div>
                <p className="font-semibold">{STEPS[step].title}</p>
                <p className="mt-1 text-sm text-ink/70 dark:text-white/60">
                  {STEPS[step].desc}
                </p>
              </div>
            </div>
          ) : null}
        </div>

        {/* Actions */}
        <div className="mt-6 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleDone}
            className="text-xs font-semibold text-ink/55 hover:text-ink dark:text-white/45 dark:hover:text-white"
          >
            Skip tour
          </button>
          <div className="flex items-center gap-2">
            {step > 0 ? (
              <button
                type="button"
                onClick={() => setStep((s) => s - 1)}
                className="rounded-lg border border-ink/20 px-3.5 py-2 text-sm font-semibold transition hover:bg-ink/5 dark:border-white/15 dark:hover:bg-white/8"
              >
                Back
              </button>
            ) : null}
            {step < STEPS.length - 1 ? (
              <button
                type="button"
                onClick={() => setStep((s) => s + 1)}
                className="rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-primary-fg transition hover:bg-primary-hover"
              >
                Next
              </button>
            ) : (
              <Link
                href="/create"
                onClick={handleDone}
                className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-primary-fg transition hover:bg-primary-hover"
              >
                <PlusCircle size={14} />
                Get Started
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Renders the onboarding modal once after first wallet connection.
 * Reads/writes onboarding state from localStorage.
 */
export function OnboardingGate({
  isConnected,
}: {
  isConnected: boolean;
}): JSX.Element | null {
  const [show, setShow] = useState(false);
  const [seenConnected, setSeenConnected] = useState(false);

  useEffect(() => {
    if (isConnected && !seenConnected) {
      setSeenConnected(true);
      if (!getOnboardingCompleted()) {
        setShow(true);
      }
    }
    if (!isConnected) {
      setSeenConnected(false);
    }
  }, [isConnected, seenConnected]);

  if (!show) return null;
  return <OnboardingModal onComplete={() => setShow(false)} />;
}
