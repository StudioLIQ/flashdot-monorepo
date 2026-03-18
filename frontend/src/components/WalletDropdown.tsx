"use client";

import { Copy, ExternalLink, LogOut } from "lucide-react";
import { useEffect, useRef } from "react";

import { EXPLORER_TX_URL } from "../lib/contracts";
import { RecentTransactions } from "./RecentTransactions";

interface WalletDropdownProps {
  account: string;
  balanceDot: string | null;
  isCorrectNetwork: boolean;
  onCopy: () => void;
  onDisconnect: () => void;
  onClose: () => void;
}

function shortAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

// Blockscout address page URL
function explorerAddressUrl(address: string): string {
  return EXPLORER_TX_URL("").replace("/tx/", `/address/${address}`);
}

export function WalletDropdown({
  account,
  balanceDot,
  isCorrectNetwork,
  onCopy,
  onDisconnect,
  onClose,
}: WalletDropdownProps): JSX.Element {
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const onPointerDown = (e: PointerEvent): void => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [onClose]);

  // Close on ESC
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      ref={dropdownRef}
      className="animate-content-fade absolute right-0 top-full z-50 mt-1.5 w-64 rounded-xl border border-ink/10 bg-white shadow-xl dark:border-white/10 dark:bg-slate-900"
    >
      {/* Account header */}
      <div className="border-b border-ink/10 px-4 py-3 dark:border-white/10">
        <p className="font-mono text-sm font-semibold">{shortAddress(account)}</p>
        <div className="mt-1.5 flex items-center gap-1.5">
          <span className={`h-1.5 w-1.5 rounded-full ${isCorrectNetwork ? "bg-success" : "bg-danger"}`} />
          <span className="text-xs text-ink/65 dark:text-white/60">
            {isCorrectNetwork ? "Polkadot Hub EVM" : "Wrong network"}
          </span>
        </div>
        {balanceDot ? (
          <p className="mt-1 font-mono text-xs font-semibold text-ink/80 dark:text-white/80">
            {balanceDot} DOT
          </p>
        ) : null}
      </div>

      <RecentTransactions />

      {/* Actions */}
      <div className="p-1.5">
        <button
          type="button"
          onClick={() => { onCopy(); onClose(); }}
          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-semibold hover:bg-ink/5 dark:hover:bg-white/8"
        >
          <Copy size={14} className="shrink-0 text-ink/55 dark:text-white/50" />
          Copy Address
        </button>
        <a
          href={explorerAddressUrl(account)}
          target="_blank"
          rel="noreferrer"
          onClick={onClose}
          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-semibold hover:bg-ink/5 dark:hover:bg-white/8"
        >
          <ExternalLink size={14} className="shrink-0 text-ink/55 dark:text-white/50" />
          View on Explorer
        </a>
        <div className="my-1 border-t border-ink/10 dark:border-white/10" />
        <button
          type="button"
          onClick={() => { onDisconnect(); onClose(); }}
          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-semibold text-danger hover:bg-danger/8"
        >
          <LogOut size={14} className="shrink-0" />
          Disconnect
        </button>
      </div>
    </div>
  );
}
