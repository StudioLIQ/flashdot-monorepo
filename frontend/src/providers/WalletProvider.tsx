"use client";

import { BrowserProvider, Eip1193Provider, formatEther } from "ethers";
import {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const POLKADOT_HUB_CHAIN_ID_DEC = 420420417;
const POLKADOT_HUB_CHAIN_ID_HEX = `0x${POLKADOT_HUB_CHAIN_ID_DEC.toString(16)}`;

export interface WalletContextValue {
  account: string | null;
  chainId: number | null;
  balanceDot: string | null;
  isConnecting: boolean;
  isSwitchingNetwork: boolean;
  isConnected: boolean;
  isCorrectNetwork: boolean;
  connectionError: string | null;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  clearConnectionError: () => void;
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
          chainName: "Polkadot Hub TestNet",
          nativeCurrency: {
            name: "PAS",
            symbol: "PAS",
            decimals: 18,
          },
          rpcUrls: ["https://eth-rpc-testnet.polkadot.io"],
          blockExplorerUrls: ["https://blockscout-testnet.polkadot.io"],
        },
      ],
    });
  }
}

export function WalletProvider({ children }: PropsWithChildren): JSX.Element {
  const [account, setAccount] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [balanceDot, setBalanceDot] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSwitchingNetwork, setIsSwitchingNetwork] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const disconnectedRef = useRef(false);

  const ethereum = useMemo(() => {
    if (typeof window === "undefined") return null;
    return (window as EthereumWindow).ethereum ?? null;
  }, []);

  const syncWallet = useCallback(async () => {
    if (!ethereum || disconnectedRef.current) return;

    const provider = new BrowserProvider(ethereum);
    const [network, accounts] = await Promise.all([provider.getNetwork(), provider.listAccounts()]);

    if (disconnectedRef.current) return;

    const activeAccount = accounts[0]?.address ?? null;
    const balance = activeAccount ? await provider.getBalance(activeAccount) : null;

    if (disconnectedRef.current) return;

    setChainId(Number(network.chainId));
    setAccount(activeAccount);
    setBalanceDot(
      balance !== null
        ? Number(formatEther(balance)).toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 4,
          })
        : null
    );
  }, [ethereum]);

  const connectWallet = useCallback(async () => {
    if (!ethereum) {
      setConnectionError("MetaMask not detected");
      return;
    }

    disconnectedRef.current = false;
    setIsConnecting(true);
    setConnectionError(null);
    try {
      await ethereum.request({ method: "eth_requestAccounts" });
      setIsSwitchingNetwork(true);
      await switchToPolkadotHub(ethereum);
      await syncWallet();
      setConnectionError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.toLowerCase().includes("user rejected")) {
        setConnectionError("Wallet connection was cancelled.");
      } else {
        setConnectionError(message);
      }
    } finally {
      setIsSwitchingNetwork(false);
      setIsConnecting(false);
    }
  }, [ethereum, syncWallet]);

  const disconnectWallet = useCallback(() => {
    disconnectedRef.current = true;
    setAccount(null);
    setChainId(null);
    setBalanceDot(null);
    setConnectionError(null);
  }, []);

  const clearConnectionError = useCallback(() => {
    setConnectionError(null);
  }, []);

  useEffect(() => {
    if (!ethereum) return;

    void syncWallet();

    const onAccountsChanged = (accounts: string[]): void => {
      if (disconnectedRef.current) return;
      setAccount(accounts[0] ?? null);
      void syncWallet();
    };
    const onChainChanged = (hexChainId: string): void => {
      if (disconnectedRef.current) return;
      setChainId(Number.parseInt(hexChainId, 16));
      void syncWallet();
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
      balanceDot,
      isConnecting,
      isSwitchingNetwork,
      isConnected: Boolean(account),
      isCorrectNetwork: chainId === POLKADOT_HUB_CHAIN_ID_DEC,
      connectionError,
      connectWallet,
      disconnectWallet,
      clearConnectionError,
    }),
    [
      account,
      balanceDot,
      chainId,
      clearConnectionError,
      connectWallet,
      connectionError,
      disconnectWallet,
      isConnecting,
      isSwitchingNetwork,
    ]
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
