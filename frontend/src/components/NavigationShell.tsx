"use client";

import {
  Activity,
  ChevronLeft,
  ChevronRight,
  Clock,
  HelpCircle,
  Home,
  PlusCircle,
  Settings,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { useMyLoans } from "../hooks/useMyLoans";
import { useWallet } from "../hooks/useWallet";
import { LoanState } from "../lib/loan-types";
import { useWalletModal } from "../providers/WalletModalProvider";
import { useToast } from "../providers/ToastProvider";
import { FlashDotMark } from "./FlashDotMark";
import { Identicon } from "./Identicon";
import { NetworkStatusBar } from "./NetworkStatusBar";
import { OnboardingGate } from "./OnboardingModal";
import { ThemeToggle } from "./ThemeToggle";
import { WalletPanel } from "./WalletPanel";
import { WalletSelectModal } from "./WalletSelectModal";

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

  // Sidebar expand state — persisted to localStorage
  const [sidebarExpanded, setSidebarExpanded] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("sidebar-expanded") === "true";
  });

  const toggleSidebar = (): void => {
    setSidebarExpanded((v) => {
      const next = !v;
      localStorage.setItem("sidebar-expanded", String(next));
      return next;
    });
  };

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
    { href: "/", label: "Dashboard", icon: <Home size={18} /> },
    { href: "/create", label: "Create", icon: <PlusCircle size={18} /> },
    {
      href: "/loans",
      label: "Active Loans",
      icon: <Activity size={18} />,
      badge: activeLoansCount || undefined,
      disabled: !isConnected,
    },
    {
      href: "/history",
      label: "History",
      icon: <Clock size={18} />,
      disabled: !isConnected,
    },
  ];

  const isActive = (href: string): boolean => {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(href + "/");
  };

  // Keyboard navigation within sidebar nav
  const sidebarNavRef = useRef<HTMLElement>(null);
  const handleNavKeyDown = (e: React.KeyboardEvent): void => {
    if (!sidebarNavRef.current) return;
    const links = Array.from(
      sidebarNavRef.current.querySelectorAll<HTMLElement>("a:not([aria-disabled='true'])")
    );
    const idx = links.findIndex((el) => el === document.activeElement);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      links[(idx + 1) % links.length]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      links[(idx - 1 + links.length) % links.length]?.focus();
    }
  };

  // Close wallet panel on route change
  useEffect(() => {
    setWalletPanelOpen(false);
  }, [pathname]);

  return (
    <div className="flex min-h-screen bg-[#f5fff8] text-ink dark:bg-[#07110f] dark:text-white">
      {/* Skip link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:rounded-lg focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-fg"
      >
        Skip to main content
      </a>

      {/* ─── Desktop sidebar (lg+) ─────────────────────────────────── */}
      <aside
        style={{ width: sidebarExpanded ? 220 : 60 }}
        className="hidden lg:flex lg:flex-col lg:shrink-0 sticky top-0 h-screen overflow-hidden border-r border-ink/10 bg-white/90 backdrop-blur transition-[width] duration-200 ease-in-out dark:border-white/10 dark:bg-slate-950/90"
      >
        {/* Logo + toggle */}
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-ink/10 px-3 dark:border-white/10">
          <Link
            href="/"
            className="flex items-center gap-2.5 overflow-hidden"
            title="FlashDot Home"
          >
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-ink/10 bg-white/90 shadow-sm dark:border-white/10 dark:bg-white/5">
              <FlashDotMark className="h-5 w-5" />
            </div>
            {sidebarExpanded ? (
              <span className="whitespace-nowrap text-sm font-bold tracking-tight">
                FlashDot
              </span>
            ) : null}
          </Link>
          <button
            type="button"
            onClick={toggleSidebar}
            aria-label={sidebarExpanded ? "Collapse sidebar" : "Expand sidebar"}
            className="rounded-lg p-1 text-ink/50 transition hover:bg-ink/5 hover:text-ink dark:text-white/40 dark:hover:bg-white/8 dark:hover:text-white"
          >
            {sidebarExpanded ? (
              <ChevronLeft size={16} />
            ) : (
              <ChevronRight size={16} />
            )}
          </button>
        </div>

        {/* Primary nav */}
        <nav
          ref={sidebarNavRef}
          aria-label="Main navigation"
          onKeyDown={handleNavKeyDown}
          className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2"
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
                title={!sidebarExpanded ? item.label : undefined}
                className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? "bg-primary/15 text-ink dark:text-white"
                    : item.disabled
                      ? "cursor-not-allowed text-ink/30 dark:text-white/25"
                      : "text-ink/65 hover:bg-ink/5 hover:text-ink dark:text-white/60 dark:hover:bg-white/8 dark:hover:text-white"
                }`}
              >
                {/* Active left bar */}
                {active ? (
                  <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-primary" />
                ) : null}
                <span className="shrink-0">{item.icon}</span>
                {sidebarExpanded ? (
                  <span className="flex-1 whitespace-nowrap">{item.label}</span>
                ) : null}
                {item.badge && sidebarExpanded ? (
                  <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-fg leading-none">
                    {item.badge}
                  </span>
                ) : null}
                {item.badge && !sidebarExpanded ? (
                  <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-primary" />
                ) : null}
              </Link>
            );
          })}
        </nav>

        {/* Bottom actions */}
        <div className="shrink-0 border-t border-ink/10 p-2 dark:border-white/10">
          {/* Settings */}
          <Link
            href="/settings"
            aria-current={pathname === "/settings" ? "page" : undefined}
            title={!sidebarExpanded ? "Settings" : undefined}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
              pathname === "/settings"
                ? "bg-primary/15 text-ink dark:text-white"
                : "text-ink/55 hover:bg-ink/5 hover:text-ink dark:text-white/45 dark:hover:bg-white/8 dark:hover:text-white"
            }`}
          >
            <Settings size={18} className="shrink-0" />
            {sidebarExpanded ? <span>Settings</span> : null}
          </Link>

          {/* Help */}
          <a
            href="https://github.com/flashdot"
            target="_blank"
            rel="noreferrer"
            title={!sidebarExpanded ? "GitHub / Docs" : undefined}
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-ink/55 transition hover:bg-ink/5 hover:text-ink dark:text-white/45 dark:hover:bg-white/8 dark:hover:text-white"
          >
            <HelpCircle size={18} className="shrink-0" />
            {sidebarExpanded ? <span>Docs / GitHub</span> : null}
          </a>

          {/* Theme toggle */}
          <div
            className="flex items-center gap-3 rounded-xl px-3 py-2"
            title={!sidebarExpanded ? "Toggle theme" : undefined}
          >
            <ThemeToggle />
            {sidebarExpanded ? (
              <span className="text-sm font-medium text-ink/55 dark:text-white/45">
                Theme
              </span>
            ) : null}
          </div>

          {/* Wallet area */}
          <div className="relative mt-1 border-t border-ink/10 pt-2 dark:border-white/10">
            {isConnected && account ? (
              <>
                <button
                  type="button"
                  onClick={() => setWalletPanelOpen((v) => !v)}
                  aria-expanded={walletPanelOpen}
                  aria-label="Open wallet panel"
                  title={!sidebarExpanded ? shortAddress(account) : undefined}
                  className="flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left transition hover:bg-ink/5 dark:hover:bg-white/8"
                >
                  <div className="shrink-0 overflow-hidden rounded-lg border border-ink/10 dark:border-white/10">
                    <Identicon address={account} size={28} />
                  </div>
                  {sidebarExpanded ? (
                    <div className="min-w-0 flex-1 overflow-hidden">
                      <p className="truncate font-mono text-xs font-semibold">
                        {shortAddress(account)}
                      </p>
                      <p className="flex items-center gap-1 text-[10px] text-ink/55 dark:text-white/45">
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${isCorrectNetwork ? "bg-success" : "bg-danger"}`}
                        />
                        {balanceDot ?? "…"} DOT
                      </p>
                    </div>
                  ) : null}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={walletModal.open}
                disabled={walletBusy}
                title={!sidebarExpanded ? "Connect Wallet" : undefined}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-fg transition hover:bg-primary-hover disabled:opacity-50"
              >
                <Wallet size={14} className="shrink-0" />
                {sidebarExpanded ? (
                  <span>
                    {isSwitchingNetwork
                      ? "Switching…"
                      : isConnecting
                        ? "Connecting…"
                        : "Connect Wallet"}
                  </span>
                ) : null}
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* ─── Main content (lg+: beside sidebar, else full width) ───── */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* ─── Mobile / Tablet top bar (< lg) ──────────────────────── */}
        <header className="sticky top-0 z-40 flex lg:hidden w-full items-center justify-between border-b border-ink/10 bg-white/90 px-4 py-3 backdrop-blur dark:border-white/10 dark:bg-slate-950/85">
          <Link href="/" className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-xl border border-ink/10 bg-white/90 shadow-sm dark:border-white/10 dark:bg-white/5">
              <FlashDotMark className="h-5 w-5" />
            </div>
            <span className="text-sm font-bold tracking-tight">FlashDot</span>
          </Link>

          <div className="flex items-center gap-2">
            {isConnected && account ? (
              <button
                type="button"
                onClick={() => setWalletPanelOpen((v) => !v)}
                aria-expanded={walletPanelOpen}
                aria-label="Open wallet panel"
                className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-xs font-semibold ${
                  isCorrectNetwork
                    ? "border-ink/15 bg-white/80 hover:bg-ink/5 dark:border-white/15 dark:bg-white/5"
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
                onClick={walletModal.open}
                disabled={walletBusy}
                className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-fg transition hover:bg-primary-hover disabled:opacity-50"
              >
                <Wallet size={13} />
                {isConnecting ? "…" : "Connect"}
              </button>
            )}
            <ThemeToggle className="rounded-full" />
          </div>
        </header>

        {/* Page content */}
        <div id="main-content" className="flex-1 pb-safe">
          {children}
        </div>

        {/* Footer */}
        <footer className="mt-16 border-t border-ink/10 pb-20 dark:border-white/10 lg:pb-0">
          <div className="mx-auto max-w-5xl px-4 py-10 md:px-6">
            {/* Top row: brand + link columns */}
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {/* Brand */}
              <div>
                <div className="flex items-center gap-2">
                  <div className="grid h-7 w-7 place-items-center rounded-lg border border-ink/10 dark:border-white/10">
                    <FlashDotMark className="h-4 w-4" />
                  </div>
                  <span className="text-sm font-bold tracking-tight">FlashDot</span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-ink/60 dark:text-white/50">
                  Bonded cross-chain flash loans on Polkadot Hub EVM. Economic atomicity via 2PC + bond escrow.
                </p>
                <span className="mt-3 inline-flex rounded-full border border-warning/40 bg-warning/10 px-2.5 py-1 font-mono text-[10px] font-semibold text-warning">
                  v0.1.0-testnet
                </span>
              </div>

              {/* Protocol */}
              <div>
                <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-ink/45 dark:text-white/35">
                  Protocol
                </p>
                <ul className="space-y-2 text-xs text-ink/65 dark:text-white/55">
                  <li>
                    <a href="https://github.com/flashdot" target="_blank" rel="noreferrer" className="transition hover:text-ink dark:hover:text-white">
                      Documentation
                    </a>
                  </li>
                  <li>
                    <a href="https://github.com/flashdot" target="_blank" rel="noreferrer" className="transition hover:text-ink dark:hover:text-white">
                      Smart Contracts
                    </a>
                  </li>
                  <li>
                    <a href="https://dorahacks.io" target="_blank" rel="noreferrer" className="transition hover:text-ink dark:hover:text-white">
                      Hackathon Submission
                    </a>
                  </li>
                  <li>
                    <a href="https://polkadot.network" target="_blank" rel="noreferrer" className="transition hover:text-ink dark:hover:text-white">
                      Polkadot Hub EVM
                    </a>
                  </li>
                </ul>
              </div>

              {/* Community */}
              <div>
                <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-ink/45 dark:text-white/35">
                  Community
                </p>
                <ul className="space-y-2 text-xs text-ink/65 dark:text-white/55">
                  <li>
                    <a href="https://github.com/flashdot" target="_blank" rel="noreferrer" className="transition hover:text-ink dark:hover:text-white">
                      GitHub
                    </a>
                  </li>
                  <li>
                    <span className="text-ink/35 dark:text-white/25">Discord (coming soon)</span>
                  </li>
                  <li>
                    <span className="text-ink/35 dark:text-white/25">Twitter (coming soon)</span>
                  </li>
                </ul>
              </div>

              {/* Legal */}
              <div>
                <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-ink/45 dark:text-white/35">
                  Legal
                </p>
                <ul className="space-y-2 text-xs text-ink/65 dark:text-white/55">
                  <li>
                    <span className="text-ink/35 dark:text-white/25">Terms of Service</span>
                  </li>
                  <li>
                    <span className="text-ink/35 dark:text-white/25">Privacy Policy</span>
                  </li>
                  <li>
                    <span className="text-ink/35 dark:text-white/25">Risk Disclosure</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Bottom row: disclaimer + network status */}
            <div className="mt-8 flex flex-wrap items-start justify-between gap-4 border-t border-ink/10 pt-6 dark:border-white/10">
              <p className="max-w-xl text-[11px] leading-relaxed text-ink/45 dark:text-white/35">
                ⚠ This is experimental software deployed on testnet. Smart contracts have not been audited.
                Do not use with real funds. Use at your own risk — funds may be lost.
              </p>
              <NetworkStatusBar />
            </div>
          </div>
        </footer>
      </div>

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
                  ? "text-primary"
                  : item.disabled
                    ? "cursor-not-allowed text-ink/25 dark:text-white/20"
                    : "text-ink/55 hover:text-ink dark:text-white/50 dark:hover:text-white"
              }`}
            >
              {/* Badge dot */}
              {item.badge ? (
                <span className="absolute right-[calc(50%-14px)] top-1.5 h-1.5 w-1.5 rounded-full bg-primary" />
              ) : null}
              <span className={active ? "text-primary" : ""}>{item.icon}</span>
              <span>{item.label === "Active Loans" ? "Active" : item.label}</span>
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

      {/* Onboarding modal — shown once after first wallet connection */}
      <OnboardingGate isConnected={isConnected} />
    </div>
  );
}
