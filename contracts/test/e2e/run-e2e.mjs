import fs from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../../");
const deployments = path.join(root, "zombienet", "deployments.json");

if (!fs.existsSync(deployments)) {
  console.log("[e2e] skipped: zombienet/deployments.json not found. Run deploy script first.");
  process.exit(0);
}

const result = spawnSync("npx", ["hardhat", "test", "test/e2e/scenarios/*.test.ts"], {
  cwd: path.join(root, "contracts"),
  stdio: "inherit",
  shell: true,
});

process.exit(result.status ?? 1);
