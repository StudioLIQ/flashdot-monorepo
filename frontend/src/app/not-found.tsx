import Link from "next/link";

export default function NotFound(): JSX.Element {
  return (
    <main className="mx-auto max-w-5xl px-4 py-16 text-center md:px-6">
      <p className="font-mono text-6xl font-bold text-primary">404</p>
      <h1 className="mt-4 text-2xl font-bold">Page not found</h1>
      <p className="mt-2 text-sm text-ink/60 dark:text-white/55">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-fg transition hover:bg-primary-hover"
      >
        Go home
      </Link>
    </main>
  );
}
