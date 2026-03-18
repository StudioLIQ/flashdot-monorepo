"use client";

import { createContext, useContext, useState } from "react";

interface WalletModalContextValue {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

const WalletModalContext = createContext<WalletModalContextValue>({
  isOpen: false,
  open: () => {},
  close: () => {},
});

export function WalletModalProvider({
  children,
}: {
  children: React.ReactNode;
}): JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <WalletModalContext.Provider
      value={{ isOpen, open: () => setIsOpen(true), close: () => setIsOpen(false) }}
    >
      {children}
    </WalletModalContext.Provider>
  );
}

export function useWalletModal(): WalletModalContextValue {
  return useContext(WalletModalContext);
}
