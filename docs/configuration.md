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
NEXT_PUBLIC_HUB_RPC_URL=http://127.0.0.1:8545
NEXT_PUBLIC_HUB_ADDRESS=0x0000000000000000000000000000000000000000
NEXT_PUBLIC_ASSET_ADDRESS=0x0000000000000000000000000000000000000000
NEXT_PUBLIC_VAULT_A_ADDRESS=0x0000000000000000000000000000000000000000
NEXT_PUBLIC_VAULT_B_ADDRESS=0x0000000000000000000000000000000000000000
```

로컬/Zombienet 배포 후에는 아래 명령으로 실제 주소가 채워진 `frontend/.env.local`을 생성할 수 있습니다.

```bash
node zombienet/scripts/export-frontend-env.mjs
```

Polkadot Hub TestNet(Paseo) 배포본을 사용할 경우에는 `frontend/.env.example` 하단의 주석 섹션을 실제 주소로 채우면 됩니다.

## Contracts

- Hardhat network config: `contracts/hardhat.config.ts`
- Zombienet deploy artifacts: `zombienet/deployments.json` (generated)
