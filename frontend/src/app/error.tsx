"use client";

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorPage({ error, reset }: ErrorPageProps): JSX.Element {
  return (
    <main className="min-h-screen bg-mesh px-6 py-10 text-ink dark:bg-mesh-dark dark:text-white md:px-10">
      <section className="mx-auto max-w-2xl rounded-3xl border border-red-200 bg-white/85 p-8 shadow-glow backdrop-blur dark:border-red-400/30 dark:bg-slate-950/75 md:p-10">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-600">FlashDot Recovery</p>
        <h1 className="mt-3 text-3xl font-bold">The interface hit an unexpected error.</h1>
        <p className="mt-3 text-sm leading-relaxed text-ink/75 dark:text-white/70">
          Wallet providers and RPC endpoints can fail transiently during demos. You can retry the
          current view without reloading the entire app.
        </p>

        <pre className="mt-6 overflow-x-auto rounded-2xl bg-ink px-4 py-4 text-xs text-white/90 dark:bg-black/40">
          {error.message}
        </pre>

        <button
          type="button"
          onClick={reset}
          className="mt-6 inline-flex items-center rounded-xl bg-ink px-5 py-3 text-sm font-semibold text-white transition hover:bg-ink/90 dark:bg-white dark:text-slate-950 dark:hover:bg-white/90"
        >
          Try Again
        </button>
      </section>
    </main>
  );
}
