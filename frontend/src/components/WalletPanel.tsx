"use client";

import { Copy, ExternalLink, LogOut, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { EXPLORER_TX_URL } from "../lib/contracts";
import { ConfirmDialog } from "./ConfirmDialog";
import { Identicon } from "./Identicon";
import { RecentTransactions } from "./RecentTransactions";

interface WalletPanelProps {
  account: string;
  balanceDot: string | null;
  isCorrectNetwork: boolean;
  onCopy: () => void;
  onDisconnect: () => void;
  onClose: () => void;
}

function explorerAddressUrl(address: string): string {
  return EXPLORER_TX_URL("").replace("/tx/", `/address/${address}`);
}

export function WalletPanel({
  account,
  balanceDot,
  isCorrectNetwork,
  onCopy,
  onDisconnect,
  onClose,
}: WalletPanelProps): JSX.Element {
  const [disconnectConfirmOpen, setDisconnectConfirmOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Focus close button when panel opens
  useEffect(() => {
    const timer = setTimeout(() => closeButtonRef.current?.focus(), 50);
    return () => clearTimeout(timer);
  }, []);

  // ESC to close
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === "Escape" && !disconnectConfirmOpen) onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose, disconnectConfirmOpen]);

  const handleDisconnect = (): void => {
    onDisconnect();
    onClose();
  };

  const fullAddr = account;
  const shortAddr = `${account.slice(0, 10)}...${account.slice(-8)}`;

  return (
    <>
      {/* Backdrop */}
      <div
        className="animate-dialog-backdrop fixed inset-0 z-50 bg-ink/40 backdrop-blur-sm dark:bg-slate-950/60"
        aria-hidden="true"
        onClick={onClose}
      />

      {/* Panel — bottom sheet on mobile, right drawer on desktop */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Wallet panel"
        className="animate-dialog-enter fixed bottom-0 left-0 right-0 z-50 max-h-[88vh] overflow-y-auto rounded-t-2xl border border-ink/10 bg-white shadow-2xl dark:border-white/10 dark:bg-slate-900 sm:bottom-auto sm:left-auto sm:right-4 sm:top-16 sm:h-auto sm:max-h-[calc(100vh-80px)] sm:w-80 sm:rounded-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-ink/10 px-5 py-4 dark:border-white/10">
          <h2 className="text-base font-semibold">My Wallet</h2>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Close wallet panel"
            className="rounded-lg p-1 text-ink/50 transition hover:bg-ink/5 hover:text-ink dark:text-white/45 dark:hover:bg-white/8 dark:hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        {/* Account identity */}
        <div className="px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="shrink-0 overflow-hidden rounded-xl border-2 border-ink/10 dark:border-white/10">
              <Identicon address={fullAddr} size={48} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-mono text-sm font-semibold">{shortAddr}</p>
              <div className="mt-1 flex items-center gap-1.5">
                <span
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                    isCorrectNetwork ? "bg-success" : "bg-danger"
                  }`}
                />
                <span className="text-xs text-ink/60 dark:text-white/55">
                  {isCorrectNetwork ? "Polkadot Hub EVM" : "Wrong Network — please switch"}
                </span>
              </div>
            </div>
          </div>

          {/* Balance card */}
          {balanceDot ? (
            <div className="mt-4 rounded-xl bg-ink/5 px-4 py-3 dark:bg-white/5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-ink/50 dark:text-white/40">
                Balance
              </p>
              <p className="mt-1 font-mono text-2xl font-bold">
                {balanceDot}{" "}
                <span className="text-base font-semibold text-ink/55 dark:text-white/50">
                  DOT
                </span>
              </p>
            </div>
          ) : null}

          {/* Action buttons */}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onCopy}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-ink/12 py-2.5 text-sm font-semibold transition hover:bg-ink/5 dark:border-white/10 dark:hover:bg-white/8"
            >
              <Copy size={14} />
              Copy Address
            </button>
            <a
              href={explorerAddressUrl(fullAddr)}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-1.5 rounded-xl border border-ink/12 py-2.5 text-sm font-semibold transition hover:bg-ink/5 dark:border-white/10 dark:hover:bg-white/8"
            >
              <ExternalLink size={14} />
              Explorer
            </a>
          </div>
        </div>

        {/* Recent transactions */}
        <RecentTransactions />

        {/* Disconnect — danger zone */}
        <div className="border-t border-ink/10 p-4 dark:border-white/10">
          <button
            type="button"
            onClick={() => setDisconnectConfirmOpen(true)}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-danger/30 py-2.5 text-sm font-semibold text-danger transition hover:bg-danger/8"
          >
            <LogOut size={14} />
            Disconnect Wallet
          </button>
        </div>
      </div>

      {/* Disconnect confirmation dialog */}
      <ConfirmDialog
        open={disconnectConfirmOpen}
        onClose={() => setDisconnectConfirmOpen(false)}
        title="Disconnect Wallet"
        description="You will need to reconnect your wallet to use FlashDot. Any on-chain transactions in progress will not be affected."
        confirmLabel="Disconnect"
        confirmTone="destructive"
        onConfirm={handleDisconnect}
      />
    </>
  );
}
