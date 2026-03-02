# FlashDot — Zombienet Local Testnet

4-node local testnet: Relay Chain + Polkadot Hub + VaultChain A + VaultChain B.

## Network Topology

| Node | Role | Para ID | EVM RPC | WS RPC |
|---|---|---|---|---|
| alice, bob | Relay validators | — | — | ws://127.0.0.1:9944 (alice) |
| hub-collator | Polkadot Hub (EVM) | 1000 | http://127.0.0.1:9945 | ws://127.0.0.1:9946 |
| vault-a-collator | Vault A parachain | 2000 | http://127.0.0.1:9947 | ws://127.0.0.1:9948 |
| vault-b-collator | Vault B parachain | 2001 | http://127.0.0.1:9949 | ws://127.0.0.1:9950 |

## Prerequisites

### Required Binaries

| Binary | Version | Download |
|---|---|---|
| `zombienet` | v1.3.x | https://github.com/paritytech/zombienet/releases |
| `polkadot` | v1.15+ | https://github.com/paritytech/polkadot-sdk/releases |
| `polkadot-parachain` | v1.15+ | Same SDK release |

All binaries must be in your `$PATH`.

```bash
# Verify binaries
zombienet --version
polkadot --version
polkadot-parachain --version
```

### Node.js
```bash
node --version  # >= 20
pnpm --version  # >= 9
```

## Quick Start

```bash
# 1. Install dependencies (from repo root)
pnpm install

# 2. Start the local testnet
zombienet spawn zombienet/config.toml

# 3. (New terminal) Deploy contracts
npx tsx zombienet/scripts/deploy.ts

# 4. Fund test accounts
npx tsx zombienet/scripts/fund-accounts.ts
```

## Test Accounts

Pre-funded dev accounts on the local testnet:

| Name | Address (SS58) | EVM Address | Balance |
|---|---|---|---|
| Alice | `5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY` | `0xd43593c715fdd31c61141abd04a99fd6822c8558` | 1M DOT |
| Bob | `5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty` | `0x8eaf04151687736326c9fea17e25fc5287613693` | 1M DOT |
| Charlie | `5FLSigC9HGRKVhB9FiEo4Y3koPsNmBmLJbpXg2mp1hXcS59Y` | — | 1M DOT |

## XCM Channels

HRMP channels are pre-configured:
- Hub (1000) ↔ Vault A (2000)
- Hub (1000) ↔ Vault B (2001)

## Running E2E Tests (M3)

```bash
# Start testnet first (separate terminal)
zombienet spawn zombienet/config.toml

# Run all 5 E2E scenarios
cd contracts && npx hardhat test test/hardhat/e2e/ --network local
```

## Troubleshooting

**Port conflicts**: Kill any lingering nodes with `pkill -f polkadot`

**HRMP channels not open**: Wait for 2-3 relay chain epochs after parachain registration

**EVM not responding**: Ensure `asset-hub-rococo-local` chain spec includes the EVM pallet
