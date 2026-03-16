import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const deploymentsPath = path.join(repoRoot, "zombienet", "deployments.json");
const outputPath = path.join(repoRoot, "frontend", ".env.local");

if (!fs.existsSync(deploymentsPath)) {
  throw new Error(`Missing ${deploymentsPath}. Run the Zombienet deploy flow first.`);
}

const deployments = JSON.parse(fs.readFileSync(deploymentsPath, "utf8"));

const content = [
  "# Generated from zombienet/deployments.json",
  `NEXT_PUBLIC_HUB_RPC_URL=${deployments.network.hubRpc}`,
  `NEXT_PUBLIC_HUB_ADDRESS=${deployments.hub}`,
  `NEXT_PUBLIC_ASSET_ADDRESS=${deployments.mockDot}`,
  `NEXT_PUBLIC_VAULT_A_ADDRESS=${deployments.vaultA}`,
  `NEXT_PUBLIC_VAULT_B_ADDRESS=${deployments.vaultB}`,
  "",
].join("\n");

fs.writeFileSync(outputPath, content, "utf8");
console.log(`Wrote ${path.relative(repoRoot, outputPath)}`);
