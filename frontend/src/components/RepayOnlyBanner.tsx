export function RepayOnlyBanner(): JSX.Element {
  return (
    <div className="rounded-xl border border-danger/45 bg-danger/10 px-4 py-3 text-sm font-semibold text-danger dark:border-danger/40 dark:bg-danger/20 dark:text-danger">
      Partial commit failure detected. Additional commits are blocked. Only committed legs can be repaid.
    </div>
  );
}
