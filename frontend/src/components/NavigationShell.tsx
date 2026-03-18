"use client";

import {
  Activity,
  Clock,
  Home,
  PlusCircle,
  Settings,
  Wallet,
} from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { useNotifications } from "../providers/NotificationProvider";
import { LOAN_STATE_META } from "../lib/loan-types";
import { NotificationBell, NotificationPanel } from "./NotificationPanel";

import { useMyLoans } from "../hooks/useMyLoans";
import { useWallet } from "../hooks/useWallet";
import { LoanState } from "../lib/loan-types";
import { useWalletModal } from "../providers/WalletModalProvider";
import { useToast } from "../providers/ToastProvider";
import { FlashDotMark } from "./FlashDotMark";
import { NetworkStatusBar } from "./NetworkStatusBar";
import { ThemeToggle } from "./ThemeToggle";

// Lazy-load heavy wallet/onboarding components
const WalletPanel = dynamic(() => import("./WalletPanel").then((m) => ({ default: m.WalletPanel })), { ssr: false });
const WalletSelectModal = dynamic(() => import("./WalletSelectModal").then((m) => ({ default: m.WalletSelectModal })), { ssr: false });
const OnboardingGate = dynamic(() => import("./OnboardingModal").then((m) => ({ default: m.OnboardingGate })), { ssr: false });

function shortAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  badge?: number | undefined;
  disabled?: boolean | undefined;
}

interface NavigationShellProps {
  children: React.ReactNode;
}

export function NavigationShell({ children }: NavigationShellProps): JSX.Element {
  const pathname = usePathname();
  const { showToast } = useToast();
  const walletModal = useWalletModal();
  const [walletPanelOpen, setWalletPanelOpen] = useState(false);
  const [notifPanelOpen, setNotifPanelOpen] = useState(false);
  const notifBellRef = useRef<HTMLDivElement>(null);
  const { addNotification } = useNotifications();
  const prevLoanStatesRef = useRef<Record<string, number>>({});

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

  const navItems: NavItem[] = [
    { href: "/", label: "Dashboard", icon: <Home size={16} /> },
    { href: "/create", label: "Create", icon: <PlusCircle size={16} /> },
    {
      href: "/loans",
      label: "Loans",
      icon: <Activity size={16} />,
      badge: activeLoansCount || undefined,
      disabled: !isConnected,
    },
    {
      href: "/history",
      label: "History",
      icon: <Clock size={16} />,
      disabled: !isConnected,
    },
  ];

  const isActive = (href: string): boolean => {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(href + "/");
  };

  // Close panels on route change
  useEffect(() => {
    setWalletPanelOpen(false);
    setNotifPanelOpen(false);
  }, [pathname]);

  // Watch for loan state changes and fire notifications
  useEffect(() => {
    const loans = myLoansQuery.data;
    if (!loans) return;
    const prev = prevLoanStatesRef.current;
    for (const loan of loans) {
      const prevState = prev[loan.loanId];
      if (prevState !== undefined && prevState !== loan.state) {
        const meta = LOAN_STATE_META[loan.state as keyof typeof LOAN_STATE_META];
        addNotification({
          type: "loan-status",
          title: `Loan #${loan.loanId} — ${meta?.label ?? `State ${loan.state}`}`,
          body: "",
          href: `/loans/${loan.loanId}`,
        });
      }
      prev[loan.loanId] = loan.state;
    }
    prevLoanStatesRef.current = { ...prev };
  }, [myLoansQuery.data, addNotification]);

  return (
    <div className="flex min-h-screen flex-col bg-[#f5fff8] text-ink dark:bg-[#07110f] dark:text-white">
      {/* Skip link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:rounded-lg focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-fg"
      >
        Skip to main content
      </a>

      {/* ─── Top navigation bar (all screen sizes) ─────────────────── */}
      <header className="sticky top-0 z-40 flex h-14 w-full items-center justify-between border-b border-ink/10 bg-white/90 px-4 backdrop-blur dark:border-white/10 dark:bg-slate-950/85">
        {/* Left: Logo */}
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2"
          title="FlashDot Home"
        >
          <div className="grid h-8 w-8 place-items-center rounded-xl border border-ink/10 bg-white/90 shadow-sm dark:border-white/10 dark:bg-white/5">
            <FlashDotMark className="h-5 w-5" />
          </div>
          <span className="hidden text-sm font-bold tracking-tight sm:block">
            FlashDot
          </span>
        </Link>

        {/* Center: Nav tabs (desktop lg+) */}
        <nav
          aria-label="Main navigation"
          className="hidden items-center gap-0.5 lg:flex"
        >
          {navItems.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.disabled ? "#" : item.href}
                aria-current={active ? "page" : undefined}
                aria-disabled={item.disabled}
                {...(item.disabled
                  ? { onClick: (e: React.MouseEvent) => e.preventDefault() }
                  : {})}
                className={`relative flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  active
                    ? "bg-primary/12 text-ink dark:text-white"
                    : item.disabled
                      ? "cursor-not-allowed text-ink/30 dark:text-white/25"
                      : "text-ink/65 hover:bg-ink/5 hover:text-ink dark:text-white/60 dark:hover:bg-white/8 dark:hover:text-white"
                }`}
              >
                {active ? (
                  <span className="absolute bottom-0 left-1/2 h-0.5 w-4 -translate-x-1/2 rounded-full bg-primary" />
                ) : null}
                {item.label}
                {item.badge ? (
                  <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold leading-none text-primary-fg">
                    {item.badge}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>

        {/* Right: Actions */}
        <div className="flex shrink-0 items-center gap-1">
          {/* Notification bell */}
          <div className="relative" ref={notifBellRef}>
            <button
              type="button"
              onClick={() => {
                setNotifPanelOpen((v) => !v);
                setWalletPanelOpen(false);
              }}
              aria-label="Open notifications"
              aria-expanded={notifPanelOpen}
              className="rounded-lg p-2 text-ink/60 transition hover:bg-ink/5 hover:text-ink dark:text-white/50 dark:hover:bg-white/8 dark:hover:text-white"
            >
              <NotificationBell />
            </button>
            {notifPanelOpen && (
              <NotificationPanel onClose={() => setNotifPanelOpen(false)} />
            )}
          </div>

          <ThemeToggle />

          {/* Settings */}
          <Link
            href="/settings"
            aria-current={pathname === "/settings" ? "page" : undefined}
            aria-label="Settings"
            title="Settings"
            className={`rounded-lg p-2 transition ${
              pathname === "/settings"
                ? "bg-primary/12 text-ink dark:text-white"
                : "text-ink/60 hover:bg-ink/5 hover:text-ink dark:text-white/50 dark:hover:bg-white/8 dark:hover:text-white"
            }`}
          >
            <Settings size={18} />
          </Link>

          {/* Wallet */}
          {isConnected && account ? (
            <button
              type="button"
              onClick={() => setWalletPanelOpen((v) => !v)}
              aria-expanded={walletPanelOpen}
              aria-label="Open wallet panel"
              className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 font-mono text-xs font-semibold transition ${
                isCorrectNetwork
                  ? "border-ink/15 bg-white/80 hover:bg-ink/5 dark:border-white/15 dark:bg-white/5 dark:hover:bg-white/8"
                  : "border-danger/40 bg-danger/10 text-danger"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${isCorrectNetwork ? "bg-success" : "bg-danger"}`}
              />
              <span className="hidden sm:inline">{shortAddress(account)}</span>
              <span className="sm:hidden">{balanceDot ?? "…"} DOT</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                // If MetaMask is present, connect directly without the selection modal
                if (isMetaMaskDetected) {
                  void connectWallet();
                } else {
                  walletModal.open();
                }
              }}
              disabled={walletBusy}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-fg transition hover:bg-primary-hover disabled:opacity-50"
            >
              <Wallet size={13} className="shrink-0" />
              <span>
                {isSwitchingNetwork
                  ? "Switching…"
                  : isConnecting
                    ? "Connecting…"
                    : "Connect"}
              </span>
            </button>
          )}
        </div>
      </header>

      {/* Page content — full width */}
      <div id="main-content" className="flex-1 pb-safe">
        {children}
      </div>

      {/* ─── Compact footer ─────────────────────────────────────────── */}
      <footer className="border-t border-ink/10 pb-20 dark:border-white/10 lg:pb-0">
        <div className="mx-auto max-w-5xl px-4 py-4 md:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-ink/50 dark:text-white/40">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5">
                <FlashDotMark className="h-3.5 w-3.5 opacity-60" />
                <span className="font-semibold text-ink/65 dark:text-white/55">
                  FlashDot v0.1.0
                </span>
              </div>
              <span>·</span>
              <span>Polkadot Hub EVM Testnet</span>
              <span>·</span>
              <a
                href="https://github.com/flashdot-apac/flashdot"
                target="_blank"
                rel="noreferrer"
                className="transition hover:text-ink dark:hover:text-white"
              >
                GitHub
              </a>
              <span>·</span>
              <a
                href="https://github.com/flashdot-apac/flashdot"
                target="_blank"
                rel="noreferrer"
                className="transition hover:text-ink dark:hover:text-white"
              >
                Docs
              </a>
            </div>
            <NetworkStatusBar />
          </div>
          <p className="mt-2 text-[11px] text-ink/40 dark:text-white/30">
            ⚠ Experimental software. Not audited. Do not use with real funds.
          </p>
        </div>
      </footer>

      {/* ─── Mobile bottom nav bar (< lg) ────────────────────────────── */}
      <nav
        aria-label="Mobile navigation"
        className="fixed bottom-0 left-0 right-0 z-40 flex border-t border-ink/10 bg-white/95 pb-safe backdrop-blur lg:hidden dark:border-white/10 dark:bg-slate-950/95"
      >
        {navItems.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.disabled ? "#" : item.href}
              aria-current={active ? "page" : undefined}
              aria-disabled={item.disabled}
              {...(item.disabled
                ? { onClick: (e: React.MouseEvent) => e.preventDefault() }
                : {})}
              className={`relative flex flex-1 flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-semibold transition-colors ${
                active
                  ? "text-primary-accessible dark:text-primary"
                  : item.disabled
                    ? "cursor-not-allowed text-ink/25 dark:text-white/20"
                    : "text-ink/55 hover:text-ink dark:text-white/50 dark:hover:text-white"
              }`}
            >
              {item.badge ? (
                <span className="absolute right-[calc(50%-14px)] top-1.5 h-1.5 w-1.5 rounded-full bg-primary" />
              ) : null}
              <span
                className={
                  active ? "text-primary-accessible dark:text-primary" : ""
                }
              >
                {item.icon}
              </span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Global Wallet Select Modal */}
      <WalletSelectModal
        open={walletModal.isOpen}
        onClose={walletModal.close}
        onSelectMetaMask={() => void connectWallet()}
        isMetaMaskDetected={isMetaMaskDetected}
      />

      {/* Global Wallet Panel */}
      {walletPanelOpen && account ? (
        <WalletPanel
          account={account}
          balanceDot={balanceDot}
          isCorrectNetwork={isCorrectNetwork}
          onCopy={() => void copyAddress()}
          onDisconnect={disconnectWallet}
          onClose={() => setWalletPanelOpen(false)}
        />
      ) : null}

      {/* Onboarding modal */}
      <OnboardingGate isConnected={isConnected} />
    </div>
  );
}
