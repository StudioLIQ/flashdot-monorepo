"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

function humanizeChainError(message: string): { title: string; description: string } {
  const lower = message.toLowerCase();
  if (lower.includes("user rejected") || lower.includes("action_rejected") || lower.includes("user denied")) {
    return {
      title: "Transaction cancelled",
      description: "You cancelled the transaction in your wallet.",
    };
  }
  if (lower.includes("insufficient funds")) {
    return {
      title: "Insufficient funds",
      description: "Your wallet doesn't have enough DOT for this transaction.",
    };
  }
  if (lower.includes("execution reverted")) {
    return {
      title: "Transaction rejected by contract",
      description: "The smart contract rejected this transaction. Please check your balance and loan parameters.",
    };
  }
  if (lower.includes("network") || lower.includes("rpc") || lower.includes("connection")) {
    return {
      title: "Network connection error",
      description: "Could not connect to Polkadot Hub EVM. Check your internet connection and try again.",
    };
  }
  return {
    title: "Unexpected error",
    description: "Something went wrong. You can retry the current page without a full reload.",
  };
}

export default function ErrorPage({ error, reset }: ErrorPageProps): JSX.Element {
  const { title, description } = humanizeChainError(error.message);

  return (
    <main className="flex min-h-[60vh] items-center justify-center px-4 py-16">
      <div className="w-full max-w-md rounded-2xl border border-danger/30 bg-white p-6 shadow-lg dark:border-danger/25 dark:bg-slate-900">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-danger/10">
            <AlertTriangle size={20} className="text-danger" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-danger">Error</p>
            <h1 className="text-base font-bold text-ink dark:text-white">{title}</h1>
          </div>
        </div>

        <p className="mt-3 text-sm text-ink/70 dark:text-white/65">{description}</p>

        {/* Raw error details (collapsible in production) */}
        <details className="mt-4">
          <summary className="cursor-pointer text-xs text-ink/45 hover:text-ink/70 dark:text-white/35 dark:hover:text-white/55">
            Technical details
          </summary>
          <pre className="mt-2 overflow-x-auto rounded-lg bg-ink/5 px-3 py-2 text-[11px] text-ink/70 dark:bg-white/5 dark:text-white/60">
            {error.message}
            {error.digest ? `\nDigest: ${error.digest}` : ""}
          </pre>
        </details>

        <div className="mt-5 flex items-center gap-2">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-fg transition hover:bg-primary-hover"
          >
            <RefreshCw size={14} />
            Try Again
          </button>
          <a
            href="/"
            className="inline-flex items-center gap-2 rounded-xl border border-ink/15 px-4 py-2 text-sm font-semibold transition hover:bg-ink/5 dark:border-white/15 dark:hover:bg-white/8"
          >
            Go Home
          </a>
        </div>
      </div>
    </main>
  );
}
