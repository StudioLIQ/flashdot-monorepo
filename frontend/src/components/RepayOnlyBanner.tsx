export function RepayOnlyBanner(): JSX.Element {
  return (
    <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 dark:border-red-400/40 dark:bg-red-950/50 dark:text-red-200">
      Partial commit failure detected. Additional commits are blocked. Only committed legs can be repaid.
    </div>
  );
}
