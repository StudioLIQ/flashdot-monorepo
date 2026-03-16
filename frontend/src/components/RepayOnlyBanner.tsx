export function RepayOnlyBanner(): JSX.Element {
  return (
    <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 dark:border-red-400/40 dark:bg-red-950/50 dark:text-red-200">
      RepayOnlyMode active: 일부 leg commit 실패가 감지되어 추가 commit이 차단되었습니다.
      Committed leg만 상환 가능합니다.
    </div>
  );
}
