/**
 * Test Account Funding Script
 *
 * Funds test accounts with DOT on the local Zombienet testnet.
 * Uses well-known dev accounts (Alice, Bob, Charlie, Dave).
 *
 * Usage:
 *   npx tsx zombienet/scripts/fund-accounts.ts
 *
 * Environment variables:
 *   HUB_WS_URL   — WebSocket URL for Polkadot Hub substrate node
 *                  (default: ws://127.0.0.1:9944)
 *
 * Test accounts (SS58 / EVM):
 *   Alice:   5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY / 0xd43593c715fdd31c61141abd04a99fd6822c8558
 *   Bob:     5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty / 0x8eaf04151687736326c9fea17e25fc5287613693
 *   Charlie: 5FLSigC9HGRKVhB9FiEo4Y3koPsNmBmLJbpXg2mp1hXcS59Y
 *   Dave:    5DAAnrj7VHTznn2AWBemMuyBwZWs6FNFjdyVXUeYum3PTXFy
 *
 * TODO (M3): Implement full funding
 *   1. Connect to Hub via polkadot-api (PAPI)
 *   2. Use sudo/balances.forceSetBalance for dev funding
 *   3. Transfer DOT to EVM accounts via asset-hub EVM deposit
 *   4. Log final balances for verification
 */

async function main(): Promise<void> {
  throw new Error("TODO: implement in M3 (T-15)");
}

main().catch((err: unknown) => {
  console.error("Funding failed:", err);
  process.exit(1);
});
