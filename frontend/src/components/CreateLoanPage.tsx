"use client";

import { useWallet } from "../hooks/useWallet";
import { useWalletModal } from "../providers/WalletModalProvider";
import { CreateLoan } from "./CreateLoan";

export function CreateLoanPage(): JSX.Element {
  const { isConnected } = useWallet();
  const walletModal = useWalletModal();

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 md:px-6 md:py-8">
      <div className="mb-6">
        <h1 className="page-title">Create New Loan</h1>
        <p className="page-subtitle">
          Configure vaults, amounts, and duration for your bonded flash loan.
        </p>
      </div>
      <div
        className={`animate-content-fade transition ${
          isConnected ? "opacity-100" : "pointer-events-none opacity-40 blur-[1px]"
        }`}
      >
        {!isConnected ? (
          <p className="mb-4 rounded-xl border border-ink/10 bg-white/60 px-4 py-3 text-center text-sm font-semibold text-ink/70 dark:border-white/10 dark:bg-white/5 dark:text-white/65">
            <button
              type="button"
              onClick={walletModal.open}
              className="underline underline-offset-2 hover:text-ink dark:hover:text-white"
            >
              Connect wallet
            </button>{" "}
            to create a loan.
          </p>
        ) : null}
        <CreateLoan />
      </div>
    </main>
  );
}
