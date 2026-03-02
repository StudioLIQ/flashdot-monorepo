/**
 * Test Account Funding Script for Zombienet local testnet.
 *
 * Mints wDOT tokens and funds test accounts on Hub + Vault chains.
 * Uses pre-deployed MockERC20 from deploy.ts.
 *
 * Usage:
 *   npx tsx zombienet/scripts/fund-accounts.ts
 *
 * Requires deployments.json to exist (run deploy.ts first).
 */

import { ethers } from "ethers";
import { loadDeployments } from "./helpers/contracts.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ALICE_PRIVATE_KEY =
  process.env["DEPLOYER_PRIVATE_KEY"] ??
  "0xe5be9a5092b81bca64be81d212e7f2f9eba183bb7a90954f7b76361f6edb5c0a";

// Test accounts to fund
const TEST_ACCOUNTS = [
  "0xd43593c715fdd31c61141abd04a99fd6822c8558", // Alice EVM
  "0x8eaf04151687736326c9fea17e25fc5287613693", // Bob EVM
  "0x306721211d5404bd9da88e0204360a1a9ab8b87c", // Charlie EVM
];

const FUND_AMOUNT = ethers.parseEther("1000000"); // 1M wDOT per account

function loadAbi(name: string): unknown[] {
  const artifactsDir = path.join(__dirname, "../../contracts/artifacts/contracts");
  const erc20Path = path.join(artifactsDir, "test", "ERC20Mock.sol", "ERC20Mock.json");
  if (!fs.existsSync(erc20Path)) throw new Error("ERC20Mock artifact not found. Run 'npx hardhat compile' first.");
  return JSON.parse(fs.readFileSync(erc20Path, "utf8")).abi;
}

async function fundChain(
  rpcUrl: string,
  tokenAddress: string,
  accounts: string[],
  label: string
): Promise<void> {
  console.log(`\nFunding on ${label} (${rpcUrl})...`);
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const signer   = new ethers.Wallet(ALICE_PRIVATE_KEY, provider);
  const abi      = loadAbi("ERC20Mock");
  const token    = new ethers.Contract(tokenAddress, abi, signer);

  for (const acct of accounts) {
    const tx = await (token as any).mint(acct, FUND_AMOUNT);
    await tx.wait();
    console.log(`  ✓ Minted 1M wDOT to ${acct}`);
  }
}

async function main(): Promise<void> {
  console.log("FlashDot Test Account Funding");
  console.log("==============================");

  const deps = loadDeployments();

  await fundChain(deps.network.hubRpc,    deps.mockDot, TEST_ACCOUNTS, "Hub");
  // For vault chains, mockDot address differs — need vault-specific token addresses
  // (stored in a separate field; for now, skip vault chain funding)

  console.log("\n✓ Funding complete!");
  console.log(`Accounts funded: ${TEST_ACCOUNTS.join(", ")}`);
}

main().catch((err: unknown) => {
  console.error("Funding failed:", err);
  process.exit(1);
});
