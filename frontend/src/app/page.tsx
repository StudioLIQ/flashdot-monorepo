"use client";

import { Wallet } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { CreateLoan } from "../components/CreateLoan";
import { FlashDotMark } from "../components/FlashDotMark";
import { LoanHistory } from "../components/LoanHistory";
import { LoanStatus } from "../components/LoanStatus";
import { Skeleton } from "../components/Skeleton";
import { ThemeToggle } from "../components/ThemeToggle";
import { useLoan } from "../hooks/useLoan";
import { useLoanHistory } from "../hooks/useLoanHistory";
import { useMyLoans } from "../hooks/useMyLoans";
import { useWallet } from "../hooks/useWallet";
import { LoanState } from "../lib/loan-types";
import { useToast } from "../providers/ToastProvider";

type Tab = "create" | "active" | "history";

function shortAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export default function HomePage(): JSX.Element {
  const { showToast } = useToast();
  const wasConnectedRef = useRef(false);
  const [activeTab, setActiveTab] = useState<Tab>("create");
  const {
    account,
    balanceDot,
    isConnected,
    isCorrectNetwork,
    isConnecting,
    isSwitchingNetwork,
    connectionError,
    connectWallet,
    disconnectWallet,
    clearConnectionError,
  } = useWallet();

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
  const activeLoansCount = useMemo(
    () => (myLoansQuery.data ?? []).filter(
      (l) => l.state !== LoanState.Settled && l.state !== LoanState.Defaulted && l.state !== LoanState.Aborted
    ).length,
    [myLoansQuery.data]
  );
  const historyCount = (loanHistoryQuery.data ?? []).length;
  const walletBusy = isConnecting || isSwitchingNetwork;
  const walletErrorIsMetaMaskMissing = (connectionError ?? "").toLowerCase().includes("metamask not detected");

  const copyAddress = async (): Promise<void> => {
    if (!account) return;
    try {
      await navigator.clipboard.writeText(account);
      showToast({ tone: "info", title: "Address copied", description: shortAddress(account) });
    } catch {
      showToast({ tone: "error", title: "Copy failed", description: "Clipboard access was blocked." });
    }
  };

  // Auto-focus first input after connect
  useEffect(() => {
    if (!wasConnectedRef.current && isConnected) {
      const firstField = document.getElementById("vault-a-amount");
      firstField?.focus();
    }
    wasConnectedRef.current = isConnected;
  }, [isConnected]);

  // Auto-switch to Active tab when a loan becomes active
  useEffect(() => {
    if (hasActiveLoan && activeTab === "create") {
      setActiveTab("active");
    }
  }, [hasActiveLoan]); // eslint-disable-line react-hooks/exhaustive-deps

  const tabs: Array<{ id: Tab; label: string; badge?: number | undefined; disabled?: boolean | undefined }> = [
    { id: "create", label: "Create" },
    { id: "active", label: "Active Loan", badge: activeLoansCount || undefined, disabled: !isConnected },
    { id: "history", label: "History", disabled: !isConnected },
  ];

  return (
    <div className="min-h-screen bg-mesh text-ink dark:bg-mesh-dark dark:text-white">
      {/* Skip link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-fg"
      >
        Skip to main content
      </a>

      {/* Sticky Header */}
      <header className="sticky top-0 z-40 w-full border-b border-ink/10 bg-white/90 backdrop-blur dark:border-white/10 dark:bg-slate-950/85">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3 md:px-6">
          {/* Logo */}
          <div className="flex shrink-0 items-center gap-2.5">
            <div className="grid h-8 w-8 place-items-center rounded-xl border border-ink/10 bg-white/90 shadow-sm dark:border-white/10 dark:bg-white/5">
              <FlashDotMark className="h-6 w-6" />
            </div>
            <span className="hidden text-sm font-bold tracking-tight sm:block">FlashDot</span>
          </div>

          {/* Tab Nav */}
          <nav aria-label="Main navigation" className="flex flex-1 items-center gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => !tab.disabled && setActiveTab(tab.id)}
                disabled={tab.disabled}
                aria-current={activeTab === tab.id ? "page" : undefined}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
                  activeTab === tab.id
                    ? "bg-primary/15 text-ink dark:text-white"
                    : tab.disabled
                      ? "cursor-not-allowed text-ink/35 dark:text-white/30"
                      : "text-ink/70 hover:bg-ink/5 dark:text-white/65 dark:hover:bg-white/8"
                }`}
              >
                {tab.label}
                {tab.badge ? (
                  <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-fg leading-none">
                    {tab.badge}
                  </span>
                ) : null}
              </button>
            ))}
          </nav>

          {/* Right: Network + Account + Theme */}
          <div className="flex shrink-0 items-center gap-2">
            {isConnected ? (
              <>
                <span
                  className={`hidden rounded-full px-2.5 py-1 text-xs font-semibold sm:inline-flex items-center gap-1 ${
                    isCorrectNetwork
                      ? "bg-success/20 text-ink dark:text-white"
                      : "bg-danger/15 text-danger"
                  }`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${isCorrectNetwork ? "bg-success" : "bg-danger"}`} />
                  {isCorrectNetwork ? "Polkadot Hub" : "Wrong network"}
                </span>
                <button
                  type="button"
                  onClick={() => void copyAddress()}
                  className="hidden rounded-full border border-ink/15 bg-white/80 px-3 py-1 font-mono text-xs font-semibold hover:bg-ink/5 dark:border-white/15 dark:bg-white/5 dark:hover:bg-white/10 sm:block"
                  title="Click to copy address"
                >
                  {account ? shortAddress(account) : "-"}
                </button>
                <span className="rounded-full bg-info/15 px-2 py-1 font-mono text-xs font-semibold text-ink dark:bg-info/20 dark:text-white">
                  {balanceDot ?? "-"} DOT
                </span>
                <button
                  type="button"
                  onClick={disconnectWallet}
                  title="Disconnect local wallet session"
                  className="rounded-full border border-ink/15 px-2.5 py-1 text-xs font-semibold text-ink/70 hover:bg-ink/5 dark:border-white/15 dark:text-white/65 dark:hover:bg-white/10"
                >
                  Disconnect
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => void connectWallet()}
                disabled={walletBusy}
                aria-label="Connect MetaMask wallet"
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-fg transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Wallet size={14} className="shrink-0" />
                {isSwitchingNetwork ? "Switching..." : isConnecting ? "Connecting..." : "Connect"}
              </button>
            )}
            <ThemeToggle className="rounded-full" />
          </div>
        </div>
      </header>

      {/* Hero Banner — shown only when disconnected */}
      {!isConnected ? (
        <div className="border-b border-ink/10 bg-white/40 px-4 py-8 backdrop-blur dark:border-white/10 dark:bg-white/3">
          <div className="mx-auto max-w-5xl">
            <h1 className="text-3xl font-bold leading-tight md:text-4xl">
              One Signature,<br className="sm:hidden" /> Multi-Chain Flash Liquidity
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink/75 dark:text-white/70 md:text-base">
              Bonded cross-chain flash loans on Polkadot Hub EVM. Economic atomicity via 2PC + bond escrow.
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => void connectWallet()}
                disabled={walletBusy}
                aria-label="Connect MetaMask wallet"
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-fg transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Wallet size={16} className="shrink-0" />
                {isSwitchingNetwork
                  ? "Switching to Polkadot Hub EVM..."
                  : isConnecting
                    ? "Connecting MetaMask..."
                    : "Connect MetaMask"}
              </button>
            </div>

            {connectionError ? (
              <div className="mt-4 max-w-lg rounded-xl border border-danger/45 bg-danger/10 px-4 py-3 text-sm text-danger dark:border-danger/40 dark:bg-danger/20">
                <p className="font-semibold">{connectionError}</p>
                {walletErrorIsMetaMaskMissing ? (
                  <p className="mt-1">
                    Install MetaMask from{" "}
                    <a
                      href="https://metamask.io/download/"
                      target="_blank"
                      rel="noreferrer"
                      className="underline underline-offset-2"
                    >
                      metamask.io/download
                    </a>
                    .
                  </p>
                ) : null}
                <button
                  type="button"
                  onClick={clearConnectionError}
                  className="mt-2 rounded-lg border border-danger/45 px-3 py-1.5 text-xs font-semibold hover:bg-danger/10"
                >
                  Dismiss
                </button>
              </div>
            ) : null}

            {/* How it works */}
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-ink/10 bg-white/70 p-3 dark:border-white/10 dark:bg-white/5">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink/55 dark:text-white/55">Step 1</p>
                <p className="mt-1 text-sm font-semibold">Pick vaults</p>
                <p className="mt-1 text-xs text-ink/70 dark:text-white/65">Select chain legs and borrowing amounts.</p>
              </div>
              <div className="rounded-xl border border-ink/10 bg-white/70 p-3 dark:border-white/10 dark:bg-white/5">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink/55 dark:text-white/55">Step 2</p>
                <p className="mt-1 text-sm font-semibold">Lock bond</p>
                <p className="mt-1 text-xs text-ink/70 dark:text-white/65">One signature secures repayment coverage.</p>
              </div>
              <div className="rounded-xl border border-ink/10 bg-white/70 p-3 dark:border-white/10 dark:bg-white/5">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink/55 dark:text-white/55">Step 3</p>
                <p className="mt-1 text-sm font-semibold">Track status</p>
                <p className="mt-1 text-xs text-ink/70 dark:text-white/65">Follow prepare, commit, and repay in real time.</p>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Main Content */}
      <main id="main-content" className="mx-auto max-w-5xl px-4 py-6 md:px-6 md:py-8">
        {/* Create Tab */}
        {activeTab === "create" ? (
          <div className={`transition ${isConnected ? "opacity-100" : "pointer-events-none opacity-40 blur-[1px]"}`}>
            {!isConnected ? (
              <p className="mb-4 rounded-xl border border-ink/10 bg-white/60 px-4 py-3 text-center text-sm font-semibold text-ink/70 dark:border-white/10 dark:bg-white/5 dark:text-white/65">
                Connect wallet to create a loan.
              </p>
            ) : null}
            <CreateLoan />
          </div>
        ) : null}

        {/* Active Loan Tab */}
        {activeTab === "active" ? (
          <div>
            {!isConnected ? (
              <div className="rounded-2xl border border-ink/10 bg-white/75 p-8 text-center backdrop-blur dark:border-white/10 dark:bg-slate-950/65">
                <p className="text-sm font-semibold text-ink/70 dark:text-white/65">Connect wallet to view active loans.</p>
              </div>
            ) : (
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
            )}
          </div>
        ) : null}

        {/* History Tab */}
        {activeTab === "history" ? (
          <div>
            {!isConnected ? (
              <div className="rounded-2xl border border-ink/10 bg-white/75 p-8 text-center backdrop-blur dark:border-white/10 dark:bg-slate-950/65">
                <p className="text-sm font-semibold text-ink/70 dark:text-white/65">Connect wallet to view loan history.</p>
              </div>
            ) : loanHistoryQuery.isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} height={56} />
                ))}
              </div>
            ) : (
              <LoanHistory
                loans={loanHistoryQuery.data ?? []}
                loading={false}
              />
            )}
          </div>
        ) : null}
      </main>

      {/* Footer */}
      <footer className="mt-12 border-t border-ink/10 dark:border-white/10">
        <div className="mx-auto max-w-5xl px-4 py-8 md:px-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold">FlashDot</p>
              <p className="mt-0.5 text-xs text-ink/60 dark:text-white/55">Bonded Cross-Chain Flash Loans on Polkadot Hub EVM</p>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-xs text-ink/60 dark:text-white/55">
              <a
                href="https://github.com/flashdot"
                target="_blank"
                rel="noreferrer"
                className="hover:text-ink dark:hover:text-white"
              >
                GitHub
              </a>
              <span className="hidden sm:inline">·</span>
              <a
                href="https://dorahacks.io"
                target="_blank"
                rel="noreferrer"
                className="hover:text-ink dark:hover:text-white"
              >
                DoraHacks
              </a>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-ink/50 dark:text-white/40">
              ⚠ This is experimental software on testnet. Use at your own risk. Funds may be lost.
            </p>
            <span className="rounded-full border border-warning/40 bg-warning/10 px-2.5 py-1 font-mono text-[10px] font-semibold text-warning">
              v0.1.0-testnet
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
