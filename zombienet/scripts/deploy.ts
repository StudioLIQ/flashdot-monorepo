/**
 * FlashDot Contract Deployment Script
 *
 * Deploys FlashDotHub on Polkadot Hub (para 1000) and
 * FlashDotVault on each vault chain (para 2000, 2001).
 *
 * Usage:
 *   npx tsx zombienet/scripts/deploy.ts
 *
 * Environment variables:
 *   HUB_RPC_URL        — EVM RPC for Polkadot Hub (default: http://127.0.0.1:9944)
 *   VAULT_A_RPC_URL    — EVM RPC for Vault A parachain
 *   VAULT_B_RPC_URL    — EVM RPC for Vault B parachain
 *   DEPLOYER_PRIVATE_KEY — deployer account private key
 *
 * TODO (M3): Implement full deployment
 *   1. Deploy MockERC20 (DOT) on each chain
 *   2. Deploy FlashDotVault on VaultA + VaultB with hubSovereignAccount
 *   3. Deploy FlashDotHub on Hub with vault addresses and XCM precompile
 *   4. Set supported chains on Hub
 *   5. Verify all contract addresses and emit deployment summary
 */

async function main(): Promise<void> {
  throw new Error("TODO: implement in M3 (T-15)");
}

main().catch((err: unknown) => {
  console.error("Deployment failed:", err);
  process.exit(1);
});
