"use client";

import { useEffect, useState } from "react";

import { useCreateLoan } from "../../hooks/useCreateLoan";
import { LoanTerms } from "./LoanTerms";
import { ReviewConfirm } from "./ReviewConfirm";
import { VaultSelector } from "./VaultSelector";

type WizardStep = 1 | 2 | 3;
type StepDirection = "forward" | "backward";

const WIZARD_STEPS = [
  { num: 1 as const, label: "Select Vaults" },
  { num: 2 as const, label: "Set Terms" },
  { num: 3 as const, label: "Review & Confirm" },
] as const;

function stepHash(step: WizardStep): string {
  return `#step-${step}`;
}

function hashToStep(hash: string): WizardStep | null {
  if (hash === "#step-1") return 1;
  if (hash === "#step-2") return 2;
  if (hash === "#step-3") return 3;
  return null;
}

function stepAnimationClass(direction: StepDirection | null): string {
  if (!direction) return "";
  return direction === "forward" ? "animate-slide-from-right" : "animate-slide-from-left";
}

export function CreateLoan(): JSX.Element {
  const state = useCreateLoan();
  const [wizardStep, setWizardStep] = useState<WizardStep>(1);
  const [stepDirection, setStepDirection] = useState<StepDirection | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Sync step from URL hash on mount
  useEffect(() => {
    const step = hashToStep(window.location.hash);
    if (step) setWizardStep(step);
  }, []);

  // Update URL hash on step change
  const goToStep = (step: WizardStep, direction: StepDirection): void => {
    setStepDirection(direction);
    setWizardStep(step);
    window.history.replaceState(null, "", stepHash(step));
  };

  const handleNext = (from: WizardStep): void => {
    const next = Math.min(from + 1, 3) as WizardStep;
    goToStep(next, "forward");
  };

  const handleBack = (from: WizardStep): void => {
    const prev = Math.max(from - 1, 1) as WizardStep;
    goToStep(prev, "backward");
  };

  return (
    <section
      className="elevation-1 rounded-none p-4 sm:rounded-2xl sm:p-6"
      aria-labelledby="create-loan-title"
    >
      {/* Header */}
      <div className="mb-5">
        <h2 id="create-loan-title" className="text-xl font-semibold">
          Create New Loan
        </h2>
        <p className="mt-0.5 text-sm text-ink/70 dark:text-white/65">
          Configure vaults, amounts, and duration for your bonded flash loan.
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-1" aria-label="Loan creation steps">
        {WIZARD_STEPS.map((s, idx) => (
          <div key={s.num} className="flex flex-1 items-center gap-1">
            <div className="flex flex-col items-center gap-1">
              <button
                type="button"
                onClick={() => wizardStep > s.num && goToStep(s.num, "backward")}
                disabled={wizardStep <= s.num}
                aria-label={`${wizardStep > s.num ? "Go back to" : ""} Step ${s.num}: ${s.label}`}
                className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold transition-colors ${
                  s.num === wizardStep
                    ? "bg-primary text-primary-fg"
                    : s.num < wizardStep
                      ? "cursor-pointer bg-primary/25 text-primary hover:bg-primary/35"
                      : "bg-ink/10 text-ink/40 dark:bg-white/10 dark:text-white/35"
                }`}
              >
                {s.num < wizardStep ? "✓" : s.num}
              </button>
              <span
                className={`hidden text-[10px] font-semibold sm:block ${
                  s.num === wizardStep
                    ? "text-ink dark:text-white"
                    : "text-ink/45 dark:text-white/40"
                }`}
              >
                {s.label}
              </span>
            </div>
            {idx < WIZARD_STEPS.length - 1 ? (
              <div
                className={`mb-4 h-px flex-1 ${
                  s.num < wizardStep ? "bg-primary/40" : "bg-ink/15 dark:bg-white/10"
                }`}
              />
            ) : null}
          </div>
        ))}
      </div>

      {/* Step content with directional slide animation */}
      <div className={`overflow-hidden ${stepAnimationClass(stepDirection)}`} key={wizardStep}>
        {/* Step 1 */}
        {wizardStep === 1 ? (
          <VaultSelector
            includeA={state.includeA}
            includeB={state.includeB}
            onToggleA={() => state.setIncludeA(!state.includeA)}
            onToggleB={() => state.setIncludeB(!state.includeB)}
            canProceed={state.canProceedToStep2}
            onNext={() => handleNext(1)}
          />
        ) : null}

        {/* Step 2 */}
        {wizardStep === 2 ? (
          <LoanTerms
            includeA={state.includeA}
            includeB={state.includeB}
            amountA={state.amountA}
            amountB={state.amountB}
            amountABigint={state.amountABigint}
            amountBBigint={state.amountBBigint}
            isInvalidA={state.isInvalidA}
            isInvalidB={state.isInvalidB}
            durationMinutes={state.durationMinutes}
            setIncludeA={state.setIncludeA}
            setIncludeB={state.setIncludeB}
            setAmountA={state.setAmountA}
            setAmountB={state.setAmountB}
            setDurationMinutes={state.setDurationMinutes}
            preview={state.preview}
            canProceedToStep3={state.canProceedToStep3}
            isGuided
            onBack={() => handleBack(2)}
            onNext={() => handleNext(2)}
          />
        ) : null}

        {/* Step 3 */}
        {wizardStep === 3 ? (
          <ReviewConfirm
            includeA={state.includeA}
            includeB={state.includeB}
            amountA={state.amountA}
            amountB={state.amountB}
            durationMinutes={state.durationMinutes}
            preview={state.preview}
            gasEstimate={state.gasEstimate}
            gasEstimateUnable={state.gasEstimateUnable}
            canSubmit={state.canSubmit}
            submitting={state.submitting}
            message={state.message}
            error={state.error}
            createdLoanId={state.createdLoanId}
            createdTxHash={state.createdTxHash}
            submittedBondAmount={state.submittedBondAmount}
            onSubmit={state.onSubmit}
            onBack={() => handleBack(3)}
            confirmOpen={confirmOpen}
            onOpenConfirm={() => setConfirmOpen(true)}
            onCloseConfirm={() => setConfirmOpen(false)}
          />
        ) : null}
      </div>
    </section>
  );
}
