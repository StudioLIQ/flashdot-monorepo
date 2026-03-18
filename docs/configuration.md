# Configuration Guide

All values are pre-filled in root `.env.example` for the Polkadot Hub TestNet (Paseo).
Copy to `.env` and `source .env` before running any commands.

## Network

| Key | Value |
|---|---|
| Chain ID | `420420417` |
| EVM RPC | `https://eth-rpc-testnet.polkadot.io` |
| WS RPC | `wss://asset-hub-paseo-rpc.n.dwellir.com` |
| Block Explorer | `https://blockscout-testnet.polkadot.io` |
| Faucet | `https://faucet.polkadot.io` → select "Hub (smart contracts)" |
| Token | PAS |

## Deployed Contracts

| Contract | Address |
|---|---|
| MockToken (wDOT) | `0xEB0AAED452428a9bE0414A00B2F001400c176d9D` |
| FlashDotHub | `0x27DBBFCCd6471b2e473cf424bc81219330e7279a` |
| FlashDotVault A | `0xc2b3F70A4B4BDE43E2c110EEC60d5688608cb71E` |
| FlashDotVault B | `0x509747fc2c2BaD594be37aA39031B322eEb4f73c` |

## Coordinator (`coordinator/.env`)

```dotenv
HUB_RPC_URL=https://eth-rpc-testnet.polkadot.io
HUB_WS_URL=wss://asset-hub-paseo-rpc.n.dwellir.com
VAULT_A_RPC_URL=https://eth-rpc-testnet.polkadot.io
VAULT_B_RPC_URL=https://eth-rpc-testnet.polkadot.io

HUB_ADDRESS=0x27DBBFCCd6471b2e473cf424bc81219330e7279a
VAULT_A_ADDRESS=0xc2b3F70A4B4BDE43E2c110EEC60d5688608cb71E
VAULT_B_ADDRESS=0x509747fc2c2BaD594be37aA39031B322eEb4f73c

COORDINATOR_PRIVATE_KEY=0x...
```

All retry/timeout/port values have code defaults and can be omitted.

## Frontend (`frontend/.env.local`)

```dotenv
NEXT_PUBLIC_HUB_RPC_URL=https://eth-rpc-testnet.polkadot.io
NEXT_PUBLIC_HUB_ADDRESS=0x27DBBFCCd6471b2e473cf424bc81219330e7279a
NEXT_PUBLIC_ASSET_ADDRESS=0xEB0AAED452428a9bE0414A00B2F001400c176d9D
NEXT_PUBLIC_VAULT_A_ADDRESS=0xc2b3F70A4B4BDE43E2c110EEC60d5688608cb71E
NEXT_PUBLIC_VAULT_B_ADDRESS=0x509747fc2c2BaD594be37aA39031B322eEb4f73c
```

## Contracts

- Hardhat config: `contracts/hardhat.config.ts`
- Deploy scripts: `contracts/scripts/deploy-*.ts`
- Zombienet artifacts: `zombienet/deployments.json` (generated)

## Live Deployments

| Service | URL |
|---|---|
| Frontend (Vercel) | <https://flashdot.vercel.app> |
| Coordinator (Railway) | <https://coordinator-production-1de8.up.railway.app> |
