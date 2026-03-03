"use client";

import { useMemo } from "react";

import { CreateLoan } from "../components/CreateLoan";
import { LoanStatus } from "../components/LoanStatus";
import { useLoan } from "../hooks/useLoan";
import { useLoanHistory } from "../hooks/useLoanHistory";
import { useMyLoans } from "../hooks/useMyLoans";
import { useWallet } from "../hooks/useWallet";
import { LoanState } from "../lib/loan-types";

function shortAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
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

  return (
    <main className="min-h-screen bg-mesh px-6 py-10 text-ink md:px-10">
      <section className="mx-auto max-w-5xl rounded-3xl border border-ink/10 bg-white/75 p-8 shadow-glow backdrop-blur md:p-12">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink/70">FlashDot</p>
        <h1 className="mt-2 text-4xl font-bold leading-tight md:text-5xl">
          One Signature, Multi-Chain Flash Liquidity
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-relaxed text-ink/80 md:text-lg">
          Connect MetaMask on Polkadot Hub EVM and create a bonded cross-chain loan plan.
          Wallet 미연결 상태에서는 대출 생성 액션이 자동 비활성화됩니다.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          {!isConnected ? (
            <button
              type="button"
              onClick={() => void connectWallet()}
              disabled={isConnecting}
              className="rounded-xl bg-ink px-5 py-3 text-sm font-semibold text-white transition hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isConnecting ? "Connecting..." : "Connect Wallet"}
            </button>
          ) : (
            <>
              <span className="rounded-xl border border-ink/15 bg-white px-4 py-2 text-sm font-semibold">
                {account ? shortAddress(account) : "-"}
              </span>
              <button
                type="button"
                onClick={disconnectWallet}
                className="rounded-xl border border-ink/20 px-4 py-2 text-sm font-semibold hover:bg-ink/5"
              >
                Disconnect
              </button>
            </>
          )}
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-ink/10 bg-white p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink/60">Connection</p>
            <p className="mt-2 text-lg font-semibold">{isConnected ? "Connected" : "Not connected"}</p>
            <p className="mt-1 text-sm text-ink/70">Address: {account ?? "-"}</p>
          </div>

          <div className="rounded-2xl border border-ink/10 bg-white p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink/60">Network</p>
            <p className="mt-2 text-lg font-semibold">Chain ID: {networkLabel}</p>
            <p className={`mt-1 text-sm ${isCorrectNetwork ? "text-neon" : "text-red-600"}`}>
              {isCorrectNetwork ? "Polkadot Hub EVM" : "Switch network required"}
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-ink/10 bg-white p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink/60">My Loans</p>
            <p className="mt-2 text-lg font-semibold">{(myLoansQuery.data ?? []).length}</p>
            <p className="mt-1 text-sm text-ink/70">Polling every 5s</p>
          </div>
          <div className="rounded-2xl border border-ink/10 bg-white p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink/60">History</p>
            <p className="mt-2 text-lg font-semibold">{(loanHistoryQuery.data ?? []).length}</p>
            <p className="mt-1 text-sm text-ink/70">Settled / Defaulted / Aborted</p>
          </div>
        </div>

        <CreateLoan />
        <LoanStatus
          loan={activeLoanQuery.data?.loan ?? null}
          legs={activeLoanQuery.data?.legs ?? []}
          refreshing={activeLoanQuery.isFetching || myLoansQuery.isFetching}
          onRepaid={() => {
            void activeLoanQuery.refetch();
            void myLoansQuery.refetch();
            void loanHistoryQuery.refetch();
          }}
        />
      </section>
    </main>
  );
}
