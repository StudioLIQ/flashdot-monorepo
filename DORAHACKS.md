# FlashDot — DoraHacks Submission

## Project Name

FlashDot ⚡

## One-liner

Bonded cross-chain flash loan aggregator on Polkadot Hub — economic atomicity without single-tx reverts.

## Track

- **Track 1**: EVM Smart Contracts — `FlashDotHub.sol`, `FlashDotVault.sol`
- **Track 2**: PVM / XCM Precompiles — XCM dispatch + ACK callback state machine via `IXcmPrecompile`

## Problem

Cross-chain flash loans are impossible with traditional single-transaction atomicity. When liquidity spans multiple parachains, a failed leg on one chain cannot revert state on another — breaking the fundamental safety guarantee of flash loans.

## Solution

FlashDot introduces **economic atomicity**: instead of relying on transaction-level reverts, the borrower locks a bond on the Hub that covers `principal + interest` for every participating vault. If repayment fails, the bond is slashed to make lenders whole.

Key innovations:
- **Bond Escrow**: Ceiling-division bond calculation guarantees lenders never lose principal + interest
- **2-Phase Commit via XCM**: Prepare → ACK → Commit → ACK lifecycle across parachains
- **Partial Commit Safety**: If some legs fail during commit, the loan enters `RepayOnlyMode` — committed legs remain repayable while no new commits proceed
- **Deterministic Default**: After expiry, anyone can trigger `triggerDefault` — bond is distributed to committed lenders proportionally

## Architecture

```
Borrower → FlashDotHub (Polkadot Hub EVM)
               ├── XCM prepare/commit → FlashDotVault A (Parachain 2000)
               ├── XCM prepare/commit → FlashDotVault B (Parachain 2001)
               └── Bond Escrow + 2PC State Machine

Coordinator (TypeScript) → watches Hub events, drives lifecycle
Frontend (Next.js 14) → wallet connection, loan creation, status tracking
```

## Tech Stack

| Layer | Technology |
|---|---|
| Smart Contracts | Solidity 0.8.28, Hardhat, Foundry |
| Cross-chain | XCM Precompile (`0x...0800`), 2-Phase Commit |
| Coordinator | TypeScript, ethers.js, SQLite (Drizzle ORM) |
| Frontend | Next.js 14, React Query, Tailwind CSS, ethers.js |
| Network | Polkadot Hub TestNet (Paseo), Chain ID 420420417 |
| Hosting | Vercel (frontend), Railway (coordinator) |

## Live Links

| Resource | URL |
|---|---|
| **Frontend** | https://flashdot.vercel.app |
| **Coordinator Health** | https://coordinator-production-1de8.up.railway.app/health |
| **Source Code** | https://github.com/StudioLIQ/flashdot-monorepo |
| **Block Explorer** | https://blockscout-testnet.polkadot.io |

## Deployed Contracts (Polkadot Hub TestNet)

| Contract | Address |
|---|---|
| MockToken (wDOT) | `0xEB0AAED452428a9bE0414A00B2F001400c176d9D` |
| FlashDotHub | `0x27DBBFCCd6471b2e473cf424bc81219330e7279a` |
| FlashDotVault A | `0xc2b3F70A4B4BDE43E2c110EEC60d5688608cb71E` |
| FlashDotVault B | `0x509747fc2c2BaD594be37aA39031B322eEb4f73c` |

## Protocol Invariants

1. **I-1**: Committed lender never loses principal + interest
2. **I-2**: `CommittedAcked` is one-way (irreversible)
3. **I-3**: Vault endpoints are idempotent
4. **I-4**: Bond covers all repay obligations + fee budgets
5. **I-5**: Vault remote endpoints are Hub-origin-only
6. **I-6**: Commit is single-execution per loan

## Testing

```bash
pnpm -C contracts test          # Hardhat unit tests
pnpm -C contracts test:forge    # Foundry unit tests
pnpm -C contracts test:e2e      # E2E scenarios (Zombienet)
pnpm -C coordinator test        # Coordinator unit tests
pnpm -C frontend build          # Frontend type-check + build
```

5 E2E scenarios: happy path, prepare failure, partial commit, default, delayed ACK.

## Security

- Reentrancy guards (`nonReentrant`) on all settlement and default paths
- Bond pre-lock before any XCM dispatch
- Access controls: `onlyOwner`, `onlyXcmExecutor`, `onlyHubOrigin`
- Pause controls block create/commit without blocking repay/default
- Ceiling division on bond calculation (lender-favorable rounding)
- All state transitions are idempotent

Details → [SECURITY.md](./SECURITY.md)

## Team

Solo builder — Incheol Yang

## Demo Video

> Demo video will be added before submission.

## How to Run Locally

```bash
# Install
pnpm install

# Contract tests
pnpm -C contracts test
pnpm -C contracts test:forge

# Start coordinator
cp coordinator/.env.example coordinator/.env
pnpm -C coordinator build && pnpm -C coordinator start

# Start frontend
cp frontend/.env.example frontend/.env.local
pnpm -C frontend dev
```

## License

MIT
