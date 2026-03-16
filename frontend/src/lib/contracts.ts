import { BrowserProvider, Contract, JsonRpcProvider } from "ethers";

export const HUB_ADDRESS = process.env.NEXT_PUBLIC_HUB_ADDRESS ?? "";
export const ASSET_ADDRESS = process.env.NEXT_PUBLIC_ASSET_ADDRESS ?? "";
export const VAULT_A_ADDRESS = process.env.NEXT_PUBLIC_VAULT_A_ADDRESS ?? "";
export const VAULT_B_ADDRESS = process.env.NEXT_PUBLIC_VAULT_B_ADDRESS ?? "";
export const HUB_RPC_URL =
  process.env.NEXT_PUBLIC_HUB_RPC_URL ?? "https://westend-asset-hub-eth-rpc.polkadot.io";

export const CHAIN_A = "0x0d9f0f7af3f664e9c8f2f5f7ea2486df6ea7ef170fca0f23b2f0ef96ed5ed6f6";
export const CHAIN_B = "0xa5ff17ebf09d6f005eb77f137f6f4e911552f0668f31f3e3065fd15f87ea9f70";

export const HUB_ABI = [
  "event LoanCreated(uint256 indexed loanId, address borrower, address asset, uint256 targetAmount, uint256 bondAmount)",
  "function createLoan((address asset,uint256 targetAmount,uint32 interestBps,uint64 expiryAt) params,(bytes32 chain,address vault,uint256 amount,uint256 feeBudget,uint32 legInterestBps)[] legSpecs) returns (uint256 loanId)",
  "function getLoan(uint256 loanId) view returns (tuple(address borrower,address asset,uint256 targetAmount,uint32 interestBps,uint64 createdAt,uint64 expiryAt,uint8 state,bool repayOnlyMode,bytes32 planHash))",
  "function getBondInfo(uint256 loanId) view returns (tuple(uint256 bondAmount,uint64 lockedAt,bool slashed))",
  "function getLegCount(uint256 loanId) view returns (uint256)",
  "function getLeg(uint256 loanId,uint256 legId) view returns (tuple(bytes32 chain,address vault,uint256 amount,uint256 feeBudget,uint32 legInterestBps,uint8 state))",
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

export async function getHubContract(ethereum: unknown): Promise<HubWriteContract> {
  if (!ethereum) {
    throw new Error("MetaMask provider not found");
  }

  if (!HUB_ADDRESS) {
    throw new Error("Missing NEXT_PUBLIC_HUB_ADDRESS env var");
  }

  const provider = new BrowserProvider(ethereum as any);
  const signer = await provider.getSigner();
  return new Contract(HUB_ADDRESS, HUB_ABI, signer) as unknown as HubWriteContract;
}

export function getHubReadContract(): HubReadContract {
  if (!HUB_ADDRESS) {
    throw new Error("Missing NEXT_PUBLIC_HUB_ADDRESS env var");
  }

  return new Contract(HUB_ADDRESS, HUB_ABI, new JsonRpcProvider(HUB_RPC_URL)) as unknown as HubReadContract;
}
