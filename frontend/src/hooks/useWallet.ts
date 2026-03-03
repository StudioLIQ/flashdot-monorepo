"use client";

import { useWalletContext } from "../providers/WalletProvider";
import type { WalletContextValue } from "../providers/WalletProvider";

export function useWallet(): WalletContextValue {
  return useWalletContext();
}
