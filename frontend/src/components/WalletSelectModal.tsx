"use client";

import { ExternalLink, X } from "lucide-react";
import { useEffect, useRef } from "react";

interface WalletSelectModalProps {
  open: boolean;
  onClose: () => void;
  onSelectMetaMask: () => void;
  isMetaMaskDetected: boolean;
}

function MetaMaskIcon(): JSX.Element {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <path d="M24.5 3.5L15.75 10.0625L17.3594 6.28125L24.5 3.5Z" fill="#E17726" />
      <path d="M3.5 3.5L12.1875 10.125L10.6406 6.28125L3.5 3.5Z" fill="#E27625" />
      <path d="M21.4375 19.25L19.0781 22.9531L24.0156 24.3594L25.4844 19.3281L21.4375 19.25Z" fill="#E27625" />
      <path d="M2.52344 19.3281L3.98438 24.3594L8.91406 22.9531L6.5625 19.25L2.52344 19.3281Z" fill="#E27625" />
      <path d="M8.63281 12.4844L7.21875 14.6094L12.1094 14.8281L11.9375 9.52344L8.63281 12.4844Z" fill="#E27625" />
      <path d="M19.3594 12.4844L16.0156 9.46094L15.8906 14.8281L20.7813 14.6094L19.3594 12.4844Z" fill="#E27625" />
      <path d="M8.91406 22.9531L11.8125 21.4688L9.30469 19.3594L8.91406 22.9531Z" fill="#E27625" />
      <path d="M16.1875 21.4688L19.0781 22.9531L18.6953 19.3594L16.1875 21.4688Z" fill="#E27625" />
    </svg>
  );
}

export function WalletSelectModal({
  open,
  onClose,
  onSelectMetaMask,
  isMetaMaskDetected,
}: WalletSelectModalProps): JSX.Element | null {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  // If MetaMask is detected, the modal is not needed — connect directly.
  // This modal only renders when MetaMask is NOT detected.
  if (!open) return null;
  if (isMetaMaskDetected) return null;

  return (
    <div
      className="animate-dialog-backdrop fixed inset-0 z-40 flex items-end bg-ink/55 px-4 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm sm:grid sm:place-items-center dark:bg-slate-950/70"
      aria-hidden="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="wallet-install-title"
        className="animate-dialog-enter w-full max-w-sm rounded-t-2xl border border-ink/10 bg-white p-5 shadow-2xl sm:rounded-2xl dark:border-white/10 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 id="wallet-install-title" className="text-base font-semibold">
              MetaMask Required
            </h3>
            <p className="mt-1 text-xs text-ink/60 dark:text-white/55">
              FlashDot requires MetaMask to connect to Polkadot Hub EVM.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-ink/40 hover:bg-ink/8 hover:text-ink dark:text-white/35 dark:hover:bg-white/8 dark:hover:text-white"
          >
            <X size={16} />
          </button>
        </div>

        <div className="mt-4 flex items-center gap-3 rounded-xl border border-ink/15 px-4 py-3 dark:border-white/10">
          <MetaMaskIcon />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">MetaMask</p>
            <p className="text-xs text-ink/55 dark:text-white/45">Browser extension wallet</p>
          </div>
          <span className="rounded-full bg-danger/15 px-2 py-0.5 text-[10px] font-bold text-danger">
            Not detected
          </span>
        </div>

        <a
          href="https://metamask.io/download/"
          target="_blank"
          rel="noreferrer"
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-fg transition hover:bg-primary-hover"
        >
          Install MetaMask <ExternalLink size={13} />
        </a>

        <p className="mt-3 text-center text-xs text-ink/45 dark:text-white/35">
          After installing, refresh the page and click Connect.
        </p>
      </div>
    </div>
  );
}
