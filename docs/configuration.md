# Configuration Guide

## Coordinator (`coordinator/.env`)

```dotenv
HUB_RPC_URL=http://127.0.0.1:8545
HUB_WS_URL=ws://127.0.0.1:8546
VAULT_A_RPC_URL=http://127.0.0.1:9545
VAULT_B_RPC_URL=http://127.0.0.1:10545

HUB_ADDRESS=0x0000000000000000000000000000000000000001
VAULT_A_ADDRESS=0x0000000000000000000000000000000000000002
VAULT_B_ADDRESS=0x0000000000000000000000000000000000000003

COORDINATOR_PRIVATE_KEY=0x...
DB_PATH=./coordinator.db
COORDINATOR_PORT=8787

MAX_RETRIES=5
RETRY_DELAYS_MS=1000,2000,5000,15000,60000
PREPARE_TIMEOUT_MS=120000
COMMIT_TIMEOUT_MS=120000
DEFAULT_CHECK_INTERVAL_MS=10000
```

`coordinator/src/config.ts`는 `.env` 파일 누락 시 즉시 실패합니다.

## Frontend (`frontend` env)

```dotenv
NEXT_PUBLIC_HUB_RPC_URL=https://westend-asset-hub-eth-rpc.polkadot.io
NEXT_PUBLIC_HUB_ADDRESS=0x...
NEXT_PUBLIC_ASSET_ADDRESS=0x...
NEXT_PUBLIC_VAULT_A_ADDRESS=0x...
NEXT_PUBLIC_VAULT_B_ADDRESS=0x...
```

## Contracts

- Hardhat network config: `contracts/hardhat.config.ts`
- Zombienet deploy artifacts: `zombienet/deployments.json` (generated)

