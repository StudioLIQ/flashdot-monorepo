"use client";

import { BrowserProvider, Eip1193Provider } from "ethers";
import {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

const POLKADOT_HUB_CHAIN_ID_DEC = 420420421;
const POLKADOT_HUB_CHAIN_ID_HEX = `0x${POLKADOT_HUB_CHAIN_ID_DEC.toString(16)}`;

export interface WalletContextValue {
  account: string | null;
  chainId: number | null;
  isConnecting: boolean;
  isConnected: boolean;
  isCorrectNetwork: boolean;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
}

interface EthereumWindow extends Window {
  ethereum?: MetaMaskProvider;
}

const WalletContext = createContext<WalletContextValue | null>(null);

interface MetaMaskProvider extends Eip1193Provider {
  on?: (event: string, listener: (...args: any[]) => void) => void;
  removeListener?: (event: string, listener: (...args: any[]) => void) => void;
}

async function switchToPolkadotHub(ethereum: MetaMaskProvider): Promise<void> {
  try {
    await ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: POLKADOT_HUB_CHAIN_ID_HEX }],
    });
  } catch (error: unknown) {
    const code = (error as { code?: number }).code;
    if (code !== 4902) throw error;

    await ethereum.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: POLKADOT_HUB_CHAIN_ID_HEX,
          chainName: "Polkadot Hub EVM",
          nativeCurrency: {
            name: "DOT",
            symbol: "DOT",
            decimals: 18,
          },
          rpcUrls: ["https://westend-asset-hub-eth-rpc.polkadot.io"],
          blockExplorerUrls: ["https://blockscout-asset-hub.parity-chains-scw.parity.io"],
        },
      ],
    });
  }
}

export function WalletProvider({ children }: PropsWithChildren): JSX.Element {
  const [account, setAccount] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  const ethereum = useMemo(() => {
    if (typeof window === "undefined") return null;
    return (window as EthereumWindow).ethereum ?? null;
  }, []);

  const syncWallet = useCallback(async () => {
    if (!ethereum) return;

    const provider = new BrowserProvider(ethereum);
    const [network, accounts] = await Promise.all([provider.getNetwork(), provider.listAccounts()]);

    setChainId(Number(network.chainId));
    setAccount(accounts[0]?.address ?? null);
  }, [ethereum]);

  const connectWallet = useCallback(async () => {
    if (!ethereum) {
      throw new Error("MetaMask not detected");
    }

    setIsConnecting(true);
    try {
      await ethereum.request({ method: "eth_requestAccounts" });
      await switchToPolkadotHub(ethereum);
      await syncWallet();
    } finally {
      setIsConnecting(false);
    }
  }, [ethereum, syncWallet]);

  const disconnectWallet = useCallback(() => {
    setAccount(null);
  }, []);

  useEffect(() => {
    if (!ethereum) return;

    void syncWallet();

    const onAccountsChanged = (accounts: string[]): void => {
      setAccount(accounts[0] ?? null);
    };
    const onChainChanged = (hexChainId: string): void => {
      setChainId(Number.parseInt(hexChainId, 16));
    };

    ethereum.on?.("accountsChanged", onAccountsChanged);
    ethereum.on?.("chainChanged", onChainChanged);

    return () => {
      ethereum.removeListener?.("accountsChanged", onAccountsChanged);
      ethereum.removeListener?.("chainChanged", onChainChanged);
    };
  }, [ethereum, syncWallet]);

  const value = useMemo<WalletContextValue>(
    () => ({
      account,
      chainId,
      isConnecting,
      isConnected: Boolean(account),
      isCorrectNetwork: chainId === POLKADOT_HUB_CHAIN_ID_DEC,
      connectWallet,
      disconnectWallet,
    }),
    [account, chainId, connectWallet, disconnectWallet, isConnecting]
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWalletContext(): WalletContextValue {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error("useWalletContext must be used inside WalletProvider");
  }
  return context;
}
