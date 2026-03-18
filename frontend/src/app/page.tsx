"use client";

import { Wallet } from "lucide-react";
import Link from "next/link";

import { useWallet } from "../hooks/useWallet";
import { useWalletModal } from "../providers/WalletModalProvider";

export default function HomePage(): JSX.Element {
  const walletModal = useWalletModal();
  const {
    isConnected,
    isConnecting,
    isSwitchingNetwork,
    connectionError,
    clearConnectionError,
  } = useWallet();

  const walletBusy = isConnecting || isSwitchingNetwork;
  const walletErrorIsMetaMaskMissing = (connectionError ?? "")
    .toLowerCase()
    .includes("metamask not detected");

  if (isConnected) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-8 md:px-6 md:py-12 animate-content-fade">
        <h1 className="text-2xl font-bold md:text-3xl">Welcome to FlashDot</h1>
        <p className="mt-2 text-sm text-ink/70 dark:text-white/65 md:text-base">
          Bonded cross-chain flash loans on Polkadot Hub EVM.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/create"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-fg transition hover:bg-primary-hover"
          >
            <Wallet size={16} className="shrink-0" />
            Create New Loan
          </Link>
          <Link
            href="/loans"
            className="inline-flex items-center gap-2 rounded-xl border border-ink/15 px-5 py-2.5 text-sm font-semibold transition hover:bg-ink/5 dark:border-white/15 dark:hover:bg-white/8"
          >
            View Active Loans
          </Link>
        </div>
      </main>
    );
  }

  return (
    <div className="animate-content-fade">
      {/* Hero */}
      <div className="border-b border-ink/10 bg-white/40 px-4 py-8 backdrop-blur dark:border-white/10 dark:bg-white/3">
        <div className="mx-auto max-w-5xl">
          <h1 className="text-3xl font-bold leading-tight md:text-4xl">
            One Signature,
            <br className="sm:hidden" /> Multi-Chain Flash Liquidity
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink/75 dark:text-white/70 md:text-base">
            Bonded cross-chain flash loans on Polkadot Hub EVM. Economic
            atomicity via 2PC + bond escrow.
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={walletModal.open}
              disabled={walletBusy}
              aria-label="Connect wallet"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-fg transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Wallet size={16} className="shrink-0" />
              {isSwitchingNetwork
                ? "Switching to Polkadot Hub EVM..."
                : isConnecting
                  ? "Connecting..."
                  : "Connect Wallet"}
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
          <div className="mt-6 grid gap-3 sm:grid-cols-4">
            {[
              {
                step: "Step 1",
                title: "Connect",
                desc: "Link your MetaMask wallet to Polkadot Hub EVM.",
              },
              {
                step: "Step 2",
                title: "Configure",
                desc: "Select chain legs, amounts, and duration.",
              },
              {
                step: "Step 3",
                title: "Execute",
                desc: "One signature locks bond and triggers flash loan.",
              },
              {
                step: "Step 4",
                title: "Settle",
                desc: "Repay across chains; bond returned on success.",
              },
            ].map(({ step, title, desc }) => (
              <div
                key={step}
                className="rounded-xl border border-ink/10 bg-white/70 p-3 dark:border-white/10 dark:bg-white/5"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink/55 dark:text-white/55">
                  {step}
                </p>
                <p className="mt-1 text-sm font-semibold">{title}</p>
                <p className="mt-1 text-xs text-ink/70 dark:text-white/65">
                  {desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
