"use client";

import { useMemo } from "react";

import { CreateLoan } from "../components/CreateLoan";
import { FlashDotMark } from "../components/FlashDotMark";
import { LoanStatus } from "../components/LoanStatus";
import { ThemeToggle } from "../components/ThemeToggle";
import { useLoan } from "../hooks/useLoan";
import { useLoanHistory } from "../hooks/useLoanHistory";
import { useMyLoans } from "../hooks/useMyLoans";
import { useWallet } from "../hooks/useWallet";
import { LoanState } from "../lib/loan-types";

function shortAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function LoadingMetric(): JSX.Element {
  return (
    <>
      <div className="mt-2 h-7 w-16 animate-pulse rounded-lg bg-ink/10 dark:bg-white/10" />
      <div className="mt-2 h-4 w-28 animate-pulse rounded-lg bg-ink/10 dark:bg-white/10" />
    </>
  );
}

export default function HomePage(): JSX.Element {
  const {
    account,
    chainId,
    isConnected,
    isCorrectNetwork,
    isConnecting,
    connectWallet,
    disconnectWallet,
  } = useWallet();

  const networkLabel = useMemo(() => {
    if (!chainId) return "Unknown";
    return `${chainId}`;
  }, [chainId]);

  const myLoansQuery = useMyLoans(account);
  const loanHistoryQuery = useLoanHistory(account);

  const activeLoanId = useMemo(() => {
    const list = myLoansQuery.data ?? [];
    if (!list.length) return null;
    const active = list.find(
      (loan) =>
        loan.state !== LoanState.Settled &&
        loan.state !== LoanState.Defaulted &&
        loan.state !== LoanState.Aborted
    );
    return (active ?? list[0])?.loanId ?? null;
  }, [myLoansQuery.data]);

  const activeLoanQuery = useLoan(activeLoanId);
  const statusLoading = Boolean(isConnected && (myLoansQuery.isLoading || activeLoanQuery.isLoading));
  const hasActiveLoan = Boolean(activeLoanQuery.data?.loan);
  const statusExpanded = statusLoading || hasActiveLoan;
  const myLoanCount = (myLoansQuery.data ?? []).length;
  const historyCount = (loanHistoryQuery.data ?? []).length;

  return (
    <main className="min-h-screen bg-mesh px-6 py-10 text-ink dark:bg-mesh-dark dark:text-white md:px-10">
      <div className="mx-auto max-w-5xl space-y-6 md:space-y-8">
        <section
          className={`rounded-3xl border border-ink/10 bg-white/75 shadow-glow backdrop-blur transition-all dark:border-white/10 dark:bg-slate-950/70 ${isConnected ? "p-8 md:p-10" : "min-h-[72vh] p-8 md:min-h-[78vh] md:p-12"}`}
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="grid h-14 w-14 place-items-center rounded-2xl border border-ink/10 bg-white/90 shadow-sm dark:border-white/10 dark:bg-white/5">
                <FlashDotMark className="h-11 w-11" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink/70 dark:text-white/65">
                  FlashDot
                </p>
                <p className="mt-1 text-sm text-ink/65 dark:text-white/55">Bond-backed liquidity router</p>
              </div>
            </div>
            <ThemeToggle />
          </div>

          <h1 className={`font-bold leading-tight ${isConnected ? "mt-3 text-4xl md:text-5xl" : "mt-10 text-5xl md:text-6xl"}`}>
            One Signature, Multi-Chain Flash Liquidity
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-relaxed text-ink/80 dark:text-white/75 md:text-lg">
            Connect MetaMask on Polkadot Hub EVM and create a bonded cross-chain loan plan.
            Loan creation is disabled until wallet is connected.
          </p>

          <div className={`mt-8 flex flex-wrap items-center gap-3 ${isConnected ? "" : "md:mt-10"}`}>
            {!isConnected ? (
              <button
                type="button"
                onClick={() => void connectWallet()}
                disabled={isConnecting}
                className="rounded-xl bg-ink px-6 py-3 text-sm font-semibold text-white transition hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-slate-950 dark:hover:bg-white/90"
              >
                {isConnecting ? "Connecting..." : "Connect Wallet"}
              </button>
            ) : (
              <>
                <span className="rounded-xl border border-ink/15 bg-white px-4 py-2 text-sm font-semibold dark:border-white/15 dark:bg-white/10">
                  {account ? shortAddress(account) : "-"}
                </span>
                <button
                  type="button"
                  onClick={disconnectWallet}
                  className="min-h-11 rounded-xl border border-ink/20 px-4 py-2 text-sm font-semibold hover:bg-ink/5 dark:border-white/15 dark:hover:bg-white/10"
                >
                  Disconnect
                </button>
              </>
            )}
          </div>

          {!isConnected ? (
            <div className="mt-8 rounded-2xl border border-ink/10 bg-white/85 p-5 dark:border-white/10 dark:bg-white/5">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink/60 dark:text-white/60">
                How it works
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-ink/10 bg-mint/60 p-3 dark:border-white/10 dark:bg-emerald-950/35">
                  <p className="text-sm font-semibold">1. Pick vaults</p>
                  <p className="mt-1 text-xs text-ink/75 dark:text-white/75">Select chain legs and borrowing amounts.</p>
                </div>
                <div className="rounded-xl border border-ink/10 bg-mint/60 p-3 dark:border-white/10 dark:bg-emerald-950/35">
                  <p className="text-sm font-semibold">2. Lock bond</p>
                  <p className="mt-1 text-xs text-ink/75 dark:text-white/75">One signature secures repayment coverage.</p>
                </div>
                <div className="rounded-xl border border-ink/10 bg-mint/60 p-3 dark:border-white/10 dark:bg-emerald-950/35">
                  <p className="text-sm font-semibold">3. Track status</p>
                  <p className="mt-1 text-xs text-ink/75 dark:text-white/75">Follow prepare, commit, and repay in real time.</p>
                </div>
              </div>
            </div>
          ) : null}

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-ink/10 bg-white p-5 dark:border-white/10 dark:bg-white/5">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink/60 dark:text-white/55">Connection</p>
              <p className="mt-2 text-lg font-semibold">{isConnected ? "Connected" : "Not connected"}</p>
              <p className="mt-1 text-sm text-ink/70 dark:text-white/65">Address: {account ?? "-"}</p>
            </div>
            <div className="rounded-2xl border border-ink/10 bg-white p-5 dark:border-white/10 dark:bg-white/5">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink/60 dark:text-white/55">Network</p>
              <p className="mt-2 text-lg font-semibold">Chain ID: {networkLabel}</p>
              <p className={`mt-1 text-sm ${isCorrectNetwork ? "text-neon" : "text-red-600"}`}>
                {isCorrectNetwork ? "Polkadot Hub EVM" : "Switch network required"}
              </p>
            </div>
          </div>
        </section>

        <section className="relative rounded-3xl border border-ink/10 bg-white/75 p-5 shadow-glow backdrop-blur transition dark:border-white/10 dark:bg-slate-950/65 md:p-7">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold uppercase tracking-[0.12em]">Action Zone</h2>
            <p className="text-sm text-ink/70 dark:text-white/65">Create and confirm a new loan plan.</p>
          </div>
          <div className={`transition ${isConnected ? "opacity-100" : "pointer-events-none opacity-25 blur-[2px]"}`}>
            <CreateLoan />
          </div>
          {!isConnected ? (
            <p className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-sm font-semibold text-ink dark:text-white">
              Connect wallet to unlock loan creation.
            </p>
          ) : null}
        </section>

        <section
          id="status-zone"
          className={`rounded-3xl border border-ink/10 bg-white/75 p-5 shadow-glow backdrop-blur transition-all duration-500 dark:border-white/10 dark:bg-slate-950/65 md:p-7 ${statusExpanded ? "opacity-100" : "opacity-80"}`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold uppercase tracking-[0.12em]">Status Zone</h2>
            <p className="text-sm text-ink/70 dark:text-white/65">
              {statusExpanded
                ? "Tracking active loan and leg-level execution."
                : "Status tracker expands after an active loan is detected."}
            </p>
          </div>
          {statusExpanded ? (
            <LoanStatus
              loan={activeLoanQuery.data?.loan ?? null}
              legs={activeLoanQuery.data?.legs ?? []}
              loading={statusLoading}
              refreshing={activeLoanQuery.isFetching || myLoansQuery.isFetching}
              onRepaid={() => {
                void activeLoanQuery.refetch();
                void myLoansQuery.refetch();
                void loanHistoryQuery.refetch();
              }}
            />
          ) : (
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-ink/10 bg-white p-5 dark:border-white/10 dark:bg-white/5">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink/60 dark:text-white/55">My Loans</p>
              {myLoansQuery.isLoading ? (
                <LoadingMetric />
              ) : (
                <>
                    <p className="mt-2 text-lg font-semibold">{myLoanCount}</p>
                    <p className="mt-1 text-sm text-ink/70 dark:text-white/65">
                      {myLoanCount === 0 ? "No loans yet. Create your first flash loan." : "Live updates enabled"}
                    </p>
                </>
              )}
            </div>
            <div className="rounded-2xl border border-ink/10 bg-white p-5 dark:border-white/10 dark:bg-white/5">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink/60 dark:text-white/55">History</p>
              {loanHistoryQuery.isLoading ? (
                <LoadingMetric />
              ) : (
                <>
                    <p className="mt-2 text-lg font-semibold">{historyCount}</p>
                    <p className="mt-1 text-sm text-ink/70 dark:text-white/65">
                      {historyCount === 0 ? "No completed loans yet." : "Recent settled, defaulted, and aborted loans"}
                    </p>
                </>
              )}
            </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
