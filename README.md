# FlashDot ⚡

**Cross-Chain Flash Loan Aggregator on Polkadot Hub**

> Aggregate liquidity from multiple parachain vaults in a single transaction — with economic atomicity guaranteed by bond escrow.

---

## Polkadot Solidity Hackathon APAC 2026

| Field | Detail |
|---|---|
| **Track** | Track 1 (EVM Smart Contracts) + Track 2 (PVM / XCM Precompiles) |
| **Chain** | Polkadot Hub (EVM) |
| **Asset** | DOT (native) |
| **Status** | In development — submission by March 20, 2026 |

---

## The Problem

Flash loans exist on Ethereum. They don't exist cross-chain.

Why? Because cross-chain atomic revert is physically impossible: if a vault on Parachain B disburses funds, you can't revert that action from Parachain A in the same block. Current cross-chain lending is slow, manual, and capital-inefficient.

**The result**: DeFi strategies that require large capital across Polkadot parachains — arbitrage, liquidations, collateral swaps — either can't be executed or require massive pre-deposited capital.

---

## The Solution

FlashDot introduces **economic atomicity** as a substitute for execution atomicity:

> A lender that disburses funds is *guaranteed* to receive `principal + interest` — either from borrower repayment or from **bond slashing** on Polkadot Hub.

### How it works

```
1. Borrower posts a bond on Hub (= max repay obligation across all vaults)
2. Hub runs 2-Phase Commit via XCM:
   Phase 1 → Vaults lock liquidity (prepare)
   Phase 2 → Vaults disburse funds to borrower (commit)
3. Borrower executes strategy, repays vaults
4. Hub releases bond (minus fees) on successful repay
5. On default: Hub slashes bond, pays each vault principal + interest
```

No lender loses money. No trust assumptions on the borrower. The bond enforces it.

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                   Polkadot Hub (EVM)                      │
│                                                           │
│   ┌────────────────────────────────────────────────┐     │
│   │              FlashDotHub.sol                   │     │
│   │                                                │     │
│   │  ┌──────────────┐  ┌──────────┐  ┌─────────┐  │     │
│   │  │  LoanManager  │  │  Bond    │  │   XCM   │  │     │
│   │  │  (2PC state   │  │  Escrow  │  │  Proxy  │  │     │
│   │  │   machine)    │  │          │  │         │  │     │
│   │  └──────────────┘  └──────────┘  └─────────┘  │     │
│   └────────────────────────────────────────────────┘     │
│                          │ XCM Precompile                  │
└──────────────────────────┼──────────────────────────────-─┘
                           │
             ┌─────────────┴──────────────┐
             ▼                            ▼
    ┌─────────────────┐         ┌──────────────────┐
    │   Vault A       │         │    Vault B        │
    │   (Parachain)   │         │    (Parachain)    │
    │                 │         │                   │
    │ FlashDotVault   │         │  FlashDotVault    │
    │   .sol (EVM)    │         │    .sol (EVM)     │
    │                 │         │                   │
    │  LP Pool        │         │   LP Pool         │
    │  prepare()      │         │   prepare()       │
    │  commit()       │         │   commit()        │
    │  repay()        │         │   repay()         │
    └─────────────────┘         └──────────────────┘
```

**Off-chain:**
- **Coordinator** (TypeScript): watches Hub events, drives lifecycle, retries failed XCM
- **Frontend** (Next.js): single-signature UX, live per-leg status tracker

---

## Why Polkadot Hub

| Feature | How FlashDot uses it |
|---|---|
| **EVM compatibility** | Solidity contracts deploy directly; MetaMask UX |
| **XCM precompile** | Cross-chain vault calls from Solidity (`xcmTransact`) |
| **Shared security** | Vault chains inherit relay chain security; bond slashing is credible |
| **Native DOT** | Bond and loan asset; no oracle risk |
| **XCM QueryResponse** | ACK callbacks for on-chain 2PC state progression |

FlashDot is only possible on Polkadot because it needs:
- EVM Solidity (track 1)
- XCM precompile for cross-chain transact (track 2)
- A native asset (DOT) that exists on all chains without bridging risk

---

## Loan Lifecycle

```
[Created]
    │ start_prepare() → XCM to all vaults
[Preparing]
    │ PreparedAcks received
[Prepared]
    │ start_commit() → XCM to all vaults → funds disbursed
[Committed]  ← Borrower executes strategy here
    │ Borrower repays
[Settling]
    │ finalize_settle()
[Settled] → Bond returned to borrower (minus fees)

── Alternative: Default ──
[Committed] → expiry passes → trigger_default()
[Defaulted] → Bond slashed → each committed vault receives principal + interest
```

### Partial Commit Safety

If Vault A commits but Vault B fails:
- **Repay-Only Mode** activates automatically
- No further commits attempted
- Borrower repays only committed legs
- At expiry: bond covers any unpaid committed legs
- Uncommitted prepared legs are unlocked

---

## Key Invariants

| Invariant | Guarantee |
|---|---|
| **No committed lender loss** | Bond always covers max committed repay obligations |
| **Commit is one-way** | `CommittedAcked` → no rollback |
| **Idempotent vault calls** | Safe under XCM duplication and reordering |
| **Bond monotonic safety** | `bond ≥ Σ(principal_i × (1 + interest_bps/10000)) + Σ(fee_budget_i)` |
| **Restricted remote surface** | Only Hub XCM sovereign can call vault endpoints |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Smart contracts | Solidity 0.8.x, Hardhat + Foundry |
| Cross-chain | Polkadot Hub XCM precompile |
| Coordinator | TypeScript, polkadot-api (PAPI), ethers.js |
| Frontend | Next.js 14, Tailwind CSS, ethers.js, polkadot-api |
| Local testnet | Zombienet (relay + Hub + VaultA + VaultB) |
| Testing | Hardhat unit tests, Zombienet E2E |
| DB (coordinator) | SQLite + Drizzle ORM |

---

## Repository Structure

```
flashdot-monorepo/
├── contracts/
│   ├── FlashDotHub.sol         # Hub: 2PC state machine + bond escrow + XCM send
│   ├── FlashDotVault.sol       # Vault: LP pool + prepare/commit/abort/repay
│   ├── interfaces/
│   │   ├── IFlashDotHub.sol
│   │   ├── IFlashDotVault.sol
│   │   └── IXcmPrecompile.sol  # Polkadot Hub XCM precompile interface
│   └── test/
│       ├── Hub.test.ts
│       └── Vault.test.ts
├── coordinator/                # TypeScript off-chain coordinator
│   ├── src/
│   │   ├── index.ts
│   │   ├── loan-watcher.ts
│   │   ├── retry-engine.ts
│   │   └── db/
│   └── package.json
├── frontend/                   # Next.js 14 frontend
│   ├── src/app/
│   ├── src/components/
│   │   ├── CreateLoan.tsx
│   │   ├── LoanStatus.tsx
│   │   └── LegTracker.tsx
│   └── package.json
├── zombienet/                  # Local testnet config
│   ├── config.toml
│   └── scripts/
├── PROJECT.md                  # Full engineering specification
├── HACKATHON.md
└── README.md
```

---

## Quick Start

### Prerequisites

```bash
node >= 20
pnpm >= 9
foundry (forge, anvil)
zombienet
```

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Run Unit Tests

```bash
# Hardhat
pnpm test:contracts

# Foundry
forge test -vvv
```

### 3. Start Local Testnet

```bash
# Start relay + Hub + VaultA + VaultB
zombienet spawn zombienet/config.toml
```

### 4. Deploy Contracts

```bash
# Deploy to local Hub testnet
pnpm deploy:local

# Deploy to Polkadot Hub testnet
pnpm deploy:testnet
```

### 5. Start Coordinator

```bash
cd coordinator
pnpm start
```

### 6. Start Frontend

```bash
cd frontend
pnpm dev
# → http://localhost:3000
```

---

## Integration Test Scenarios

All 5 scenarios run automatically against local Zombienet:

```bash
pnpm test:e2e
```

| # | Scenario | What it proves |
|---|---|---|
| 1 | **Happy path** | prepare → commit → repay → settle → bond returned | Full success path |
| 2 | **Prepare failure** | VaultB rejects → VaultA aborted → bond returned | Fail-safe abort |
| 3 | **Partial commit** | VaultA commits, VaultB fails → repay-only → settle | Economic atomicity |
| 4 | **Default** | No repay after expiry → bond slashed → vaults paid | Bond enforcement |
| 5 | **Delayed ACK** | Late XCM response → coordinator retry → no double-action | Idempotency |

---

## Bond & Risk Model

### Bond Calculation

```
bond_required = Σ repay_i + Σ fee_budget_i + hub_fee_buffer

where:
  repay_i = principal_i × (1 + interest_bps / 10_000)
```

**Example:**
- Borrow 1,000 DOT from Vault A (rate: 5 bps), 2,000 DOT from Vault B (rate: 5 bps)
- `repay_A = 1,000 × 1.0005 = 1,000.5 DOT`
- `repay_B = 2,000 × 1.0005 = 2,001 DOT`
- Fee budgets: 10 DOT
- Bond required: `≈ 3,011.5 DOT`

### Why Bond = Loan Asset

Using the same asset for bond and loan eliminates oracle price risk entirely. On default, slashed DOT directly covers DOT obligations — no liquidation, no price feed, no slippage.

---

## Security Highlights

- **Origin verification**: Vault endpoints only accept calls from Polkadot Hub XCM sovereign account
- **Single-execution guarantee**: `commit()` checks `state == Prepared`; idempotent on repeat
- **Bond pre-funded**: Bond locked at `createLoan()`, before any XCM is sent
- **Emergency pause**: `pauseCreate()` and `pauseCommit()` without blocking repay/default
- **No arbitrary execution**: Only specific vault endpoints are remotely callable

---

## Comparison

| Protocol | Flash loans | Cross-chain | No trust | Capital efficient |
|---|---|---|---|---|
| Aave / Uniswap | Single-chain only | No | Yes | Yes |
| Existing XCM lending | No flash loans | Yes | Partial | No |
| **FlashDot** | Cross-chain | Yes | Yes (bond) | Yes |

---

## Roadmap (Post-Hackathon)

1. **Mainnet deployment**: Partner agreements with Hydration, Moonbeam, Bifrost vaults
2. **Multi-asset borrowing**: Oracle integration for non-DOT bonds
3. **Permissionless vaults**: Anyone can deploy a compliant `FlashDotVault.sol`
4. **Strategy SDK**: Pre-built borrower strategy templates (arbitrage, liquidation)
5. **W3F Grant pathway**: Full audit + production hardening

---

## License

MIT — See [LICENSE](./LICENSE)

---

## Team

Built for the **Polkadot Solidity Hackathon APAC 2026** (Feb 15 – Mar 20, 2026)
Organized by **OpenGuild** and **Web3 Foundation**

---

> FlashDot proves that cross-chain flash loans are not a theoretical exercise.
> They are an engineering problem — and Polkadot Hub + XCM is the only platform that can solve it.
