/**
 * E2E test setup — connects to deployed contracts on Zombienet.
 * Loads addresses from zombienet/deployments.json and creates ethers.js contract instances.
 */

import { ethers } from "ethers";
import { loadDeployments, Deployments } from "../../../zombienet/scripts/helpers/contracts";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadAbi(contractName: string): unknown[] {
  const base = path.join(__dirname, "../../../contracts/artifacts/contracts");
  const search = (dir: string): string | null => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const found = search(full);
        if (found) return found;
      } else if (entry.name === `${contractName}.json`) {
        return full;
      }
    }
    return null;
  };
  const file = search(base);
  if (!file) throw new Error(`ABI not found for ${contractName}. Run 'npx hardhat compile'.`);
  return JSON.parse(fs.readFileSync(file, "utf8")).abi;
}

export interface E2EContracts {
  hub:     ethers.Contract;
  vaultA:  ethers.Contract;
  vaultB:  ethers.Contract;
  token:   ethers.Contract;
  signer:  ethers.Wallet;
  deps:    Deployments;
}

const ALICE_KEY =
  process.env["DEPLOYER_PRIVATE_KEY"] ??
  "0xe5be9a5092b81bca64be81d212e7f2f9eba183bb7a90954f7b76361f6edb5c0a";

export async function setupE2E(): Promise<E2EContracts> {
  const deps = loadDeployments();

  const hubProvider = new ethers.JsonRpcProvider(deps.network.hubRpc);
  const signer      = new ethers.Wallet(ALICE_KEY, hubProvider);

  const hub    = new ethers.Contract(deps.hub,    loadAbi("FlashDotHub"),  signer);
  const vaultA = new ethers.Contract(deps.vaultA, loadAbi("FlashDotVault"), signer);
  const vaultB = new ethers.Contract(deps.vaultB, loadAbi("FlashDotVault"), signer);
  const token  = new ethers.Contract(deps.mockDot, loadAbi("ERC20Mock"),   signer);

  console.log("E2E Setup complete:");
  console.log(`  Hub:    ${deps.hub}`);
  console.log(`  VaultA: ${deps.vaultA}`);
  console.log(`  VaultB: ${deps.vaultB}`);

  return { hub, vaultA, vaultB, token, signer, deps };
}
