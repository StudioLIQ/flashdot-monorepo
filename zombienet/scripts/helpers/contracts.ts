/**
 * Deployed contract address management for FlashDot Zombienet testnet.
 * Reads/writes to zombienet/deployments.json.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEPLOYMENTS_FILE = path.join(__dirname, "../../deployments.json");

export interface Deployments {
  hub: string;
  vaultA: string;
  vaultB: string;
  mockDot: string;
  network: {
    hubRpc: string;
    vaultARpc: string;
    vaultBRpc: string;
    relayWs: string;
  };
  deployedAt: number;
}

export function saveDeployments(deps: Deployments): void {
  fs.writeFileSync(DEPLOYMENTS_FILE, JSON.stringify(deps, null, 2));
  console.log(`Deployments saved to ${DEPLOYMENTS_FILE}`);
}

export function loadDeployments(): Deployments {
  if (!fs.existsSync(DEPLOYMENTS_FILE)) {
    throw new Error(`Deployments file not found: ${DEPLOYMENTS_FILE}. Run deploy.ts first.`);
  }
  return JSON.parse(fs.readFileSync(DEPLOYMENTS_FILE, "utf8")) as Deployments;
}
