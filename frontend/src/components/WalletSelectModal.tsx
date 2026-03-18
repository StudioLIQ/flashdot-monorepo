"use client";

import { ExternalLink } from "lucide-react";
import { useEffect, useRef } from "react";

interface WalletOption {
  id: string;
  name: string;
  icon: React.ReactNode;
  detected?: boolean;
  installUrl?: string;
  comingSoon?: boolean;
}

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

function ChainIcon({ color }: { color: string }): JSX.Element {
  return (
    <div className="grid h-7 w-7 place-items-center rounded-full" style={{ background: color + "30" }}>
      <div className="h-3.5 w-3.5 rounded-full" style={{ background: color }} />
    </div>
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

  if (!open) return null;

  const wallets: WalletOption[] = [
    {
      id: "metamask",
      name: "MetaMask",
      icon: <MetaMaskIcon />,
      detected: isMetaMaskDetected,
      installUrl: "https://metamask.io/download/",
    },
    {
      id: "subwallet",
      name: "SubWallet",
      icon: <ChainIcon color="#4c88ff" />,
      comingSoon: true,
    },
    {
      id: "talisman",
      name: "Talisman",
      icon: <ChainIcon color="#d4a574" />,
      comingSoon: true,
    },
    {
      id: "walletconnect",
      name: "WalletConnect",
      icon: <ChainIcon color="#3b99fc" />,
      comingSoon: true,
    },
  ];

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
        aria-labelledby="wallet-select-title"
        className="animate-dialog-enter w-full max-w-sm rounded-t-2xl border border-ink/10 bg-white p-5 shadow-2xl sm:rounded-2xl dark:border-white/10 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="wallet-select-title" className="text-base font-semibold">Connect Wallet</h3>
        <p className="mt-1 text-xs text-ink/60 dark:text-white/55">Select a wallet to connect to Polkadot Hub EVM.</p>

        <div className="mt-4 grid gap-2">
          {wallets.map((wallet) => {
            if (wallet.comingSoon) {
              return (
                <div
                  key={wallet.id}
                  className="flex items-center gap-3 rounded-xl border border-ink/10 px-4 py-3 opacity-50 dark:border-white/10"
                >
                  {wallet.icon}
                  <span className="flex-1 text-sm font-semibold">{wallet.name}</span>
                  <span className="rounded-full border border-ink/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ink/50 dark:border-white/15 dark:text-white/40">
                    Coming soon
                  </span>
                </div>
              );
            }

            if (wallet.id === "metamask") {
              return (
                <button
                  key={wallet.id}
                  type="button"
                  onClick={() => { onSelectMetaMask(); onClose(); }}
                  className="flex items-center gap-3 rounded-xl border border-ink/15 px-4 py-3 text-left transition hover:border-primary/30 hover:bg-primary/5 dark:border-white/10 dark:hover:border-primary/25 dark:hover:bg-primary/8"
                >
                  {wallet.icon}
                  <span className="flex-1 text-sm font-semibold">{wallet.name}</span>
                  {wallet.detected ? (
                    <span className="rounded-full bg-success/20 px-2 py-0.5 text-[10px] font-bold text-success">
                      Detected
                    </span>
                  ) : (
                    <a
                      href={wallet.installUrl}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 text-[10px] font-bold text-info hover:underline"
                    >
                      Install <ExternalLink size={9} />
                    </a>
                  )}
                </button>
              );
            }

            return null;
          })}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full rounded-lg border border-ink/15 py-2 text-sm font-semibold text-ink/60 hover:bg-ink/5 dark:border-white/10 dark:text-white/55 dark:hover:bg-white/5"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
