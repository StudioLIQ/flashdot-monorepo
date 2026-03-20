import { BrowserProvider, Contract, EnsResolver, getAddress, isAddress, JsonRpcProvider, Network } from "ethers";
import type { Eip1193Provider } from "ethers";

export const HUB_ADDRESS = (process.env.NEXT_PUBLIC_HUB_ADDRESS ?? "").trim();
export const ASSET_ADDRESS = (process.env.NEXT_PUBLIC_ASSET_ADDRESS ?? "").trim();
export const VAULT_A_ADDRESS = (process.env.NEXT_PUBLIC_VAULT_A_ADDRESS ?? "").trim();
export const VAULT_B_ADDRESS = (process.env.NEXT_PUBLIC_VAULT_B_ADDRESS ?? "").trim();
export const HUB_RPC_URL =
  (process.env.NEXT_PUBLIC_HUB_RPC_URL ?? "https://eth-rpc-testnet.polkadot.io").trim();
export const EXPLORER_TX_URL = (txHash: string): string =>
  `https://blockscout-testnet.polkadot.io/tx/${txHash}`;

export const CHAIN_A = "0x0d9f0f7af3f664e9c8f2f5f7ea2486df6ea7ef170fca0f23b2f0ef96ed5ed6f6";
export const CHAIN_B = "0xa5ff17ebf09d6f005eb77f137f6f4e911552f0668f31f3e3065fd15f87ea9f70";

const HUB_NETWORK = Network.from({ name: "polkadot-hub-testnet", chainId: 420420417 });

/**
 * BrowserProvider subclass that completely disables ENS.
 * Polkadot Hub has no ENS registry — every ENS code path must be blocked.
 */
class NoEnsBrowserProvider extends BrowserProvider {
  constructor(ethereum: Eip1193Provider) {
    super(ethereum, HUB_NETWORK);
  }
  override async resolveName(name: string): Promise<string | null> {
    if (isAddress(name)) return getAddress(name);
    return null;
  }
  override async getResolver(_name: string): Promise<null | EnsResolver> {
    return null;
  }
}

/**
 * JsonRpcProvider subclass that completely disables ENS.
 */
class NoEnsJsonRpcProvider extends JsonRpcProvider {
  constructor(url: string) {
    super(url, HUB_NETWORK, { staticNetwork: HUB_NETWORK });
  }
  override async resolveName(name: string): Promise<string | null> {
    if (isAddress(name)) return getAddress(name);
    return null;
  }
  override async getResolver(_name: string): Promise<null | EnsResolver> {
    return null;
  }
}

/** BrowserProvider with ENS disabled for Polkadot Hub */
export function hubBrowserProvider(ethereum: unknown): BrowserProvider {
  return new NoEnsBrowserProvider(ethereum as Eip1193Provider);
}

export const HUB_ABI = [
  "event LoanCreated(uint256 indexed loanId, address borrower, address asset, uint256 targetAmount, uint256 bondAmount)",
  "function createLoan((address asset,uint256 targetAmount,uint32 interestBps,uint64 expiryAt) params,(bytes32 chain,address vault,uint256 amount,uint256 feeBudget,uint32 legInterestBps)[] legSpecs) returns (uint256 loanId)",
  "function cancelBeforeCommit(uint256 loanId)",
  "function getLoan(uint256 loanId) view returns (tuple(address borrower,address asset,uint256 targetAmount,uint32 interestBps,uint64 createdAt,uint64 expiryAt,uint8 state,bool repayOnlyMode,bytes32 planHash))",
  "function getBondInfo(uint256 loanId) view returns (tuple(uint256 bondAmount,uint64 lockedAt,bool slashed))",
  "function getLegCount(uint256 loanId) view returns (uint256)",
  "function getLeg(uint256 loanId,uint256 legId) view returns (tuple(bytes32 chain,address vault,uint256 amount,uint256 feeBudget,uint32 legInterestBps,uint8 state))",
 ] as const;

export const VAULT_ABI = [
  "function repay(uint256 loanId, uint256 amount)",
] as const;

export const ERC20_ABI = [
  "function balanceOf(address account) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
] as const;

export interface HubLoanRecord {
  borrower: string;
  asset: string;
  targetAmount: bigint;
  interestBps: number;
  createdAt: bigint;
  expiryAt: bigint;
  state: number;
  repayOnlyMode: boolean;
  planHash: string;
}

export interface HubBondInfoRecord {
  bondAmount: bigint;
  lockedAt: bigint;
  slashed: boolean;
}

export interface HubLegRecord {
  chain: string;
  vault: string;
  amount: bigint;
  feeBudget: bigint;
  legInterestBps: number;
  state: number;
}

export interface HubLoanCreatedLog {
  args: {
    0: bigint;
    1: string;
    loanId: bigint;
    borrower: string;
  };
}

export interface HubWriteContract {
  createLoan: (
    params: {
      asset: string;
      targetAmount: bigint;
      interestBps: number;
      expiryAt: number;
    },
    legs: Array<{
      chain: string;
      vault: string;
      amount: bigint;
      feeBudget: bigint;
      legInterestBps: number;
    }>
  ) => Promise<{ wait: () => Promise<{ logs: unknown[] }> }>;
  cancelBeforeCommit: (loanId: bigint) => Promise<{ wait: () => Promise<unknown> }>;
  interface: {
    parseLog: (log: unknown) => { name?: string; args: Array<{ toString: () => string }> } | null;
  };
}

export interface HubReadContract {
  getLoan: (loanId: bigint) => Promise<HubLoanRecord>;
  getBondInfo: (loanId: bigint) => Promise<HubBondInfoRecord>;
  getLegCount: (loanId: bigint) => Promise<bigint>;
  getLeg: (loanId: bigint, legId: number) => Promise<HubLegRecord>;
  queryFilter: (event: unknown, fromBlock: number, toBlock: string) => Promise<HubLoanCreatedLog[]>;
  filters: {
    LoanCreated: () => unknown;
  };
}

export interface VaultWriteContract {
  repay: (loanId: bigint, amount: bigint) => Promise<{ wait: () => Promise<unknown> }>;
}

export async function getHubContract(ethereum: unknown): Promise<HubWriteContract> {
  if (!ethereum) {
    throw new Error("MetaMask provider not found");
  }

  if (!HUB_ADDRESS) {
    throw new Error("Missing NEXT_PUBLIC_HUB_ADDRESS env var");
  }

  const provider = hubBrowserProvider(ethereum);
  const signer = await provider.getSigner();
  return new Contract(HUB_ADDRESS, HUB_ABI, signer) as unknown as HubWriteContract;
}

export function getHubReadContract(): HubReadContract {
  if (!HUB_ADDRESS) {
    throw new Error("Missing NEXT_PUBLIC_HUB_ADDRESS env var");
  }

  return new Contract(HUB_ADDRESS, HUB_ABI, new NoEnsJsonRpcProvider(HUB_RPC_URL)) as unknown as HubReadContract;
}
