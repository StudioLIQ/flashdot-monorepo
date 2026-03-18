import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

const sharedAccounts = process.env["DEPLOYER_PRIVATE_KEY"] ? [process.env["DEPLOYER_PRIVATE_KEY"]] : [];

const networks: NonNullable<HardhatUserConfig["networks"]> = {
  hardhat: {
    chainId: 31337,
  },
  local: {
    url: "http://127.0.0.1:8545",
    chainId: 31337,
  },
  // Polkadot Hub TestNet (Paseo)
  hubTestnet: {
    url: process.env["HUB_RPC_URL"] ?? "https://eth-rpc-testnet.polkadot.io",
    chainId: 420420417,
    accounts: sharedAccounts,
  },
};

if (process.env["VAULT_A_RPC_URL"]) {
  networks["vaultATestnet"] = {
    url: process.env["VAULT_A_RPC_URL"],
    chainId: Number(process.env["VAULT_A_CHAIN_ID"] ?? "420420417"),
    accounts: sharedAccounts,
  };
}

if (process.env["VAULT_B_RPC_URL"]) {
  networks["vaultBTestnet"] = {
    url: process.env["VAULT_B_RPC_URL"],
    chainId: Number(process.env["VAULT_B_CHAIN_ID"] ?? "420420417"),
    accounts: sharedAccounts,
  };
}

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      evmVersion: "cancun",
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test/hardhat",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  networks,
  typechain: {
    outDir: "typechain-types",
    target: "ethers-v6",
  },
};

export default config;
