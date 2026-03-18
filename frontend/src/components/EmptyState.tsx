"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import Link from "next/link";

// ─── Predefined illustrations ────────────────────────────────────────────────

function IllustrationNoLoans(): JSX.Element {
  return (
    <svg width="88" height="88" viewBox="0 0 88 88" fill="none" aria-hidden="true" className="opacity-55">
      <rect x="12" y="22" width="64" height="44" rx="6" stroke="#42db8d" strokeWidth="2.5" fill="none" />
      <rect x="20" y="31" width="18" height="12" rx="2" fill="#42db8d" fillOpacity="0.2" stroke="#42db8d" strokeWidth="1.5" />
      <rect x="44" y="31" width="18" height="12" rx="2" fill="#42db8d" fillOpacity="0.1" stroke="#42db8d" strokeWidth="1.5" />
      <rect x="20" y="50" width="40" height="5" rx="2" fill="#42db8d" fillOpacity="0.12" />
      <polygon points="70,25 63,40 69,40 62,56 74,37 68,37" fill="#f5ad32" opacity="0.85" />
    </svg>
  );
}

function IllustrationNoHistory(): JSX.Element {
  return (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none" aria-hidden="true" className="opacity-55">
      <circle cx="36" cy="36" r="24" stroke="#42db8d" strokeWidth="2.5" fill="none" />
      <circle cx="36" cy="36" r="2.5" fill="#42db8d" />
      <line x1="36" y1="36" x2="36" y2="22" stroke="#42db8d" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="36" y1="36" x2="46" y2="36" stroke="#f5ad32" strokeWidth="2.5" strokeLinecap="round" />
      <rect x="50" y="42" width="22" height="28" rx="3" stroke="#42db8d" strokeWidth="2" fill="none" />
      <line x1="55" y1="51" x2="67" y2="51" stroke="#42db8d" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
      <line x1="55" y1="56" x2="67" y2="56" stroke="#42db8d" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
    </svg>
  );
}

function IllustrationNoConnection(): JSX.Element {
  return (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none" aria-hidden="true" className="opacity-55">
      <circle cx="40" cy="40" r="26" stroke="#42db8d" strokeWidth="2.5" fill="none" strokeDasharray="6 4" />
      <circle cx="40" cy="40" r="10" stroke="#42db8d" strokeWidth="2" fill="none" />
      <line x1="40" y1="14" x2="40" y2="22" stroke="#42db8d" strokeWidth="2" strokeLinecap="round" />
      <line x1="66" y1="40" x2="58" y2="40" stroke="#42db8d" strokeWidth="2" strokeLinecap="round" />
      <line x1="40" y1="66" x2="40" y2="58" stroke="#f5ad32" strokeWidth="2" strokeLinecap="round" />
      <line x1="14" y1="40" x2="22" y2="40" stroke="#f5ad32" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

const ILLUSTRATIONS = {
  "no-loans": IllustrationNoLoans,
  "no-history": IllustrationNoHistory,
  "no-connection": IllustrationNoConnection,
} as const;

type IllustrationKey = keyof typeof ILLUSTRATIONS;

// ─── EmptyState ──────────────────────────────────────────────────────────────

interface EmptyStateAction {
  label: string;
  href?: string;
  onClick?: () => void;
}

interface EmptyStateProps {
  illustration?: IllustrationKey;
  title: string;
  description?: string;
  action?: EmptyStateAction;
}

export function EmptyState({
  illustration = "no-loans",
  title,
  description,
  action,
}: EmptyStateProps): JSX.Element {
  const Illustration = ILLUSTRATIONS[illustration];

  return (
    <div className="flex flex-col items-center gap-4 py-12 text-center">
      <Illustration />
      <div>
        <p className="type-h3 text-ink dark:text-white">{title}</p>
        {description ? (
          <p className="type-body mt-2 max-w-xs text-ink/65 dark:text-white/55">{description}</p>
        ) : null}
      </div>
      {action ? (
        action.href ? (
          <Link
            href={action.href}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-fg transition hover:bg-primary-hover"
          >
            {action.label}
          </Link>
        ) : (
          <button
            type="button"
            onClick={action.onClick}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-fg transition hover:bg-primary-hover"
          >
            {action.label}
          </button>
        )
      ) : null}
    </div>
  );
}

// ─── ErrorState ──────────────────────────────────────────────────────────────

interface ErrorStateProps {
  title?: string;
  description?: string;
  retry?: () => void;
}

export function ErrorState({
  title = "Something went wrong",
  description = "Check your network connection and try again.",
  retry,
}: ErrorStateProps): JSX.Element {
  return (
    <div className="flex flex-col items-center gap-4 py-12 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-danger/10">
        <AlertTriangle size={24} className="text-danger" />
      </div>
      <div>
        <p className="type-h3 text-ink dark:text-white">{title}</p>
        {description ? (
          <p className="type-body mt-2 max-w-xs text-ink/65 dark:text-white/55">{description}</p>
        ) : null}
      </div>
      {retry ? (
        <button
          type="button"
          onClick={retry}
          className="inline-flex items-center gap-2 rounded-xl border border-ink/20 px-5 py-2.5 text-sm font-semibold transition hover:bg-ink/5 dark:border-white/20 dark:hover:bg-white/8"
        >
          <RefreshCw size={14} />
          Try again
        </button>
      ) : null}
    </div>
  );
}
