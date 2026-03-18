"use client";

import { Wallet } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";

import { useMyLoans } from "../hooks/useMyLoans";
import { useWallet } from "../hooks/useWallet";
import { LoanState } from "../lib/loan-types";
import { useWalletModal } from "../providers/WalletModalProvider";
import { useToast } from "../providers/ToastProvider";
import { FlashDotMark } from "./FlashDotMark";
import { ThemeToggle } from "./ThemeToggle";
import { WalletDropdown } from "./WalletDropdown";
import { WalletSelectModal } from "./WalletSelectModal";

function shortAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function NavigationShell({
  children,
}: {
  children: React.ReactNode;
}): JSX.Element {
  const pathname = usePathname();
  const { showToast } = useToast();
  const walletModal = useWalletModal();
  const [walletDropdownOpen, setWalletDropdownOpen] = useState(false);

  const {
    account,
    balanceDot,
    isConnected,
    isCorrectNetwork,
    isConnecting,
    isSwitchingNetwork,
    connectWallet,
    disconnectWallet,
  } = useWallet();

  const myLoansQuery = useMyLoans(account);
  const activeLoansCount = useMemo(
    () =>
      (myLoansQuery.data ?? []).filter(
        (l) =>
          l.state !== LoanState.Settled &&
          l.state !== LoanState.Defaulted &&
          l.state !== LoanState.Aborted
      ).length,
    [myLoansQuery.data]
  );

  const isMetaMaskDetected =
    typeof window !== "undefined" &&
    Boolean((window as { ethereum?: unknown }).ethereum);
  const walletBusy = isConnecting || isSwitchingNetwork;

  const copyAddress = async (): Promise<void> => {
    if (!account) return;
    try {
      await navigator.clipboard.writeText(account);
      showToast({
        tone: "info",
        title: "Address copied",
        description: shortAddress(account),
      });
    } catch {
      showToast({
        tone: "error",
        title: "Copy failed",
        description: "Clipboard access was blocked.",
      });
    }
  };

  const navLinks = [
    { href: "/create", label: "Create" },
    {
      href: "/loans",
      label: "Active Loans",
      badge: activeLoansCount || undefined,
      disabled: !isConnected,
    },
    { href: "/history", label: "History", disabled: !isConnected },
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
          <Link href="/" className="flex shrink-0 items-center gap-2.5">
            <div className="grid h-8 w-8 place-items-center rounded-xl border border-ink/10 bg-white/90 shadow-sm dark:border-white/10 dark:bg-white/5">
              <FlashDotMark className="h-6 w-6" />
            </div>
            <span className="hidden text-sm font-bold tracking-tight sm:block">
              FlashDot
            </span>
          </Link>

          {/* Tab Nav */}
          <nav aria-label="Main navigation" className="flex flex-1 items-center gap-1">
            {navLinks.map((link) => {
              const isActive =
                pathname === link.href ||
                (link.href !== "/" && pathname.startsWith(link.href + "/"));
              return (
                <Link
                  key={link.href}
                  href={link.disabled ? "#" : link.href}
                  aria-current={isActive ? "page" : undefined}
                  aria-disabled={link.disabled}
                  {...(link.disabled
                    ? { onClick: (e: React.MouseEvent) => e.preventDefault() }
                    : {})}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
                    isActive
                      ? "bg-primary/15 text-ink dark:text-white"
                      : link.disabled
                        ? "cursor-not-allowed text-ink/35 dark:text-white/30"
                        : "text-ink/70 hover:bg-ink/5 dark:text-white/65 dark:hover:bg-white/8"
                  }`}
                >
                  {link.label}
                  {link.badge ? (
                    <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-fg leading-none">
                      {link.badge}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </nav>

          {/* Right: Account dropdown + Theme */}
          <div className="relative flex shrink-0 items-center gap-2">
            {isConnected ? (
              <>
                <button
                  type="button"
                  onClick={() => setWalletDropdownOpen((v) => !v)}
                  aria-expanded={walletDropdownOpen}
                  aria-label="Wallet account menu"
                  className={`hidden items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-xs font-semibold sm:inline-flex ${
                    isCorrectNetwork
                      ? "border-ink/15 bg-white/80 hover:bg-ink/5 dark:border-white/15 dark:bg-white/5 dark:hover:bg-white/10"
                      : "border-danger/40 bg-danger/10 text-danger"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${isCorrectNetwork ? "bg-success" : "bg-danger"}`}
                  />
                  {account ? shortAddress(account) : "-"}
                </button>
                {/* Mobile: balance indicator */}
                <button
                  type="button"
                  onClick={() => setWalletDropdownOpen((v) => !v)}
                  aria-expanded={walletDropdownOpen}
                  aria-label="Wallet account menu"
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-xs font-semibold sm:hidden ${
                    isCorrectNetwork
                      ? "border-ink/15 bg-white/80 hover:bg-ink/5 dark:border-white/15 dark:bg-white/5 dark:hover:bg-white/10"
                      : "border-danger/40 bg-danger/10 text-danger"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${isCorrectNetwork ? "bg-success" : "bg-danger"}`}
                  />
                  {balanceDot ?? "-"} DOT
                </button>
                {walletDropdownOpen && account ? (
                  <WalletDropdown
                    account={account}
                    balanceDot={balanceDot}
                    isCorrectNetwork={isCorrectNetwork}
                    onCopy={() => void copyAddress()}
                    onDisconnect={disconnectWallet}
                    onClose={() => setWalletDropdownOpen(false)}
                  />
                ) : null}
              </>
            ) : (
              <button
                type="button"
                onClick={walletModal.open}
                disabled={walletBusy}
                aria-label="Connect wallet"
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-fg transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Wallet size={14} className="shrink-0" />
                {isSwitchingNetwork
                  ? "Switching..."
                  : isConnecting
                    ? "Connecting..."
                    : "Connect"}
              </button>
            )}
            <ThemeToggle className="rounded-full" />
          </div>
        </div>
      </header>

      {/* Page content */}
      <div id="main-content">{children}</div>

      {/* Footer */}
      <footer className="mt-12 border-t border-ink/10 dark:border-white/10">
        <div className="mx-auto max-w-5xl px-4 py-8 md:px-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold">FlashDot</p>
              <p className="mt-0.5 text-xs text-ink/60 dark:text-white/55">
                Bonded Cross-Chain Flash Loans on Polkadot Hub EVM
              </p>
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
              ⚠ This is experimental software on testnet. Use at your own risk.
              Funds may be lost.
            </p>
            <span className="rounded-full border border-warning/40 bg-warning/10 px-2.5 py-1 font-mono text-[10px] font-semibold text-warning">
              v0.1.0-testnet
            </span>
          </div>
        </div>
      </footer>

      {/* Global Wallet Select Modal */}
      <WalletSelectModal
        open={walletModal.isOpen}
        onClose={walletModal.close}
        onSelectMetaMask={() => void connectWallet()}
        isMetaMaskDetected={isMetaMaskDetected}
      />
    </div>
  );
}
