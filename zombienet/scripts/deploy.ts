/**
 * FlashDot Contract Deployment Script for Zombienet local testnet.
 *
 * Deploys:
 *   1. MockERC20 (DOT) on Hub, VaultA, VaultB
 *   2. FlashDotVault on VaultA (para 2000) and VaultB (para 2001)
 *   3. FlashDotHub on Hub (para 1000)
 *   4. Registers supported chains on Hub
 *
 * Usage:
 *   npx tsx zombienet/scripts/deploy.ts
 *
 * Environment variables:
 *   HUB_RPC_URL        — EVM RPC for Polkadot Hub (default: http://127.0.0.1:9945)
 *   VAULT_A_RPC_URL    — EVM RPC for Vault A parachain (default: http://127.0.0.1:9947)
 *   VAULT_B_RPC_URL    — EVM RPC for Vault B parachain (default: http://127.0.0.1:9949)
 *   DEPLOYER_PRIVATE_KEY — deployer account private key (default: Alice dev key)
 */

import { ethers } from "ethers";
import { saveDeployments } from "./helpers/contracts.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Default Zombienet EVM RPC endpoints
const HUB_RPC_URL     = process.env["HUB_RPC_URL"]     ?? "http://127.0.0.1:9945";
const VAULT_A_RPC_URL = process.env["VAULT_A_RPC_URL"] ?? "http://127.0.0.1:9947";
const VAULT_B_RPC_URL = process.env["VAULT_B_RPC_URL"] ?? "http://127.0.0.1:9949";

// Alice dev account private key (well-known on local testnets)
const ALICE_PRIVATE_KEY =
  process.env["DEPLOYER_PRIVATE_KEY"] ??
  "0xe5be9a5092b81bca64be81d212e7f2f9eba183bb7a90954f7b76361f6edb5c0a";

// XCM precompile address on Polkadot Hub EVM
const XCM_PRECOMPILE_ADDRESS = "0x0000000000000000000000000000000000000800";

// Hub XCM sovereign account for VaultA/VaultB (para 1000 sovereign on para 2000)
// In a real deployment this is computed from parachain derivation
// For MVP/demo: use the deployer as the sovereign (gated by Hub contract)
const HUB_SOVEREIGN = "0x5C4fD4aB28B7b3F61A5DE9Dc6C1Ed29b7C7C5b0"; // placeholder

function loadArtifact(name: string) {
  const artifactsDir = path.join(__dirname, "../../contracts/artifacts/contracts");
  const files = findArtifact(artifactsDir, `${name}.json`);
  if (!files.length) throw new Error(`Artifact not found for ${name}`);
  const artifact = JSON.parse(fs.readFileSync(files[0]!, "utf8"));
  return { abi: artifact.abi, bytecode: artifact.bytecode };
}

function findArtifact(dir: string, name: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findArtifact(full, name));
    } else if (entry.name === name) {
      results.push(full);
    }
  }
  return results;
}

async function deploy(
  signer: ethers.Wallet,
  name: string,
  args: unknown[]
): Promise<string> {
  const { abi, bytecode } = loadArtifact(name);
  const factory = new ethers.ContractFactory(abi, bytecode, signer);
  console.log(`  Deploying ${name}...`);
  const contract = await factory.deploy(...args);
  await contract.waitForDeployment();
  const addr = await contract.getAddress();
  console.log(`  ✓ ${name} deployed at ${addr}`);
  return addr;
}

async function main(): Promise<void> {
  console.log("FlashDot Zombienet Deployment");
  console.log("================================");
  console.log(`Hub RPC:    ${HUB_RPC_URL}`);
  console.log(`VaultA RPC: ${VAULT_A_RPC_URL}`);
  console.log(`VaultB RPC: ${VAULT_B_RPC_URL}`);

  const hubProvider     = new ethers.JsonRpcProvider(HUB_RPC_URL);
  const vaultAProvider  = new ethers.JsonRpcProvider(VAULT_A_RPC_URL);
  const vaultBProvider  = new ethers.JsonRpcProvider(VAULT_B_RPC_URL);

  const hubSigner    = new ethers.Wallet(ALICE_PRIVATE_KEY, hubProvider);
  const vaultASigner = new ethers.Wallet(ALICE_PRIVATE_KEY, vaultAProvider);
  const vaultBSigner = new ethers.Wallet(ALICE_PRIVATE_KEY, vaultBProvider);

  console.log(`\nDeployer: ${hubSigner.address}`);

  // 1. Deploy MockERC20 on each chain
  console.log("\n[1/4] Deploying MockERC20 (DOT)...");
  const mockDotHub    = await deploy(hubSigner,    "ERC20Mock", ["Wrapped DOT", "wDOT", 10]);
  const mockDotVaultA = await deploy(vaultASigner, "ERC20Mock", ["Wrapped DOT", "wDOT", 10]);
  const mockDotVaultB = await deploy(vaultBSigner, "ERC20Mock", ["Wrapped DOT", "wDOT", 10]);

  // 2. Deploy FlashDotVault on each vault chain
  console.log("\n[2/4] Deploying FlashDotVault...");
  const vaultA = await deploy(vaultASigner, "FlashDotVault", [mockDotVaultA, HUB_SOVEREIGN]);
  const vaultB = await deploy(vaultBSigner, "FlashDotVault", [mockDotVaultB, HUB_SOVEREIGN]);

  // 3. Deploy FlashDotHub
  console.log("\n[3/4] Deploying FlashDotHub...");
  const xcmExecutorAddr = XCM_PRECOMPILE_ADDRESS; // Hub XCM executor = precompile on Hub
  const feeRecipient    = hubSigner.address;
  const hubAddr = await deploy(hubSigner, "FlashDotHub", [
    xcmExecutorAddr,
    feeRecipient,
    XCM_PRECOMPILE_ADDRESS,
  ]);

  // 4. Configure Hub
  console.log("\n[4/4] Configuring Hub...");
  const { abi: hubAbi } = loadArtifact("FlashDotHub");
  const hubContract = new ethers.Contract(hubAddr, hubAbi, hubSigner);

  // Register supported chains
  const chainA = ethers.keccak256(ethers.toUtf8Bytes("parachain-2000"));
  const chainB = ethers.keccak256(ethers.toUtf8Bytes("parachain-2001"));
  await hubContract.setSupportedChains([chainA, chainB]);
  console.log("  ✓ Supported chains registered");

  // Save deployments
  saveDeployments({
    hub:     hubAddr,
    vaultA,
    vaultB,
    mockDot: mockDotHub,
    network: {
      hubRpc:    HUB_RPC_URL,
      vaultARpc: VAULT_A_RPC_URL,
      vaultBRpc: VAULT_B_RPC_URL,
      relayWs:   "ws://127.0.0.1:9944",
    },
    deployedAt: Date.now(),
  });

  console.log("\n✓ Deployment complete!");
  console.log(`  Hub:    ${hubAddr}`);
  console.log(`  VaultA: ${vaultA}`);
  console.log(`  VaultB: ${vaultB}`);
}

main().catch((err: unknown) => {
  console.error("Deployment failed:", err);
  process.exit(1);
});
