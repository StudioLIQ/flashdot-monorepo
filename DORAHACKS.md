# FlashDot — Bonded Cross-Chain Flash Loan Aggregator

## One-liner

Flash loans across Polkadot parachains, secured by bond-backed economic atomicity instead of single-transaction reverts.

## Problem

Flash loans on Aave or dYdX work because everything happens in a single transaction — if the borrower doesn't repay, the entire transaction reverts. This guarantee breaks the moment you cross chain boundaries: a failed repay on Chain B cannot revert a disbursement on Chain A.

As a result, **cross-chain flash loans do not exist today**. Liquidity stays siloed per chain, and large-capital DeFi strategies (arbitrage, liquidations, collateral swaps) across parachains remain impractical.

## Why This Matters

Flash loans are one of DeFi's most-used primitives — Aave alone processes billions in flash loan volume monthly. But they only work within a single chain. As Polkadot parachains grow real DeFi activity, demand for cross-chain capital movement is inevitable: arbitrage between parachain DEXes, cross-chain liquidations, collateral rebalancing.

FlashDot turns siloed parachain liquidity into a unified capital pool accessible through one Hub transaction. LPs earn yield on their own chain with no bridging or counterparty risk. Borrowers get deeper liquidity than any single chain can offer.

The bond model is **chain-agnostic** — any EVM parachain can deploy a vault and plug into the network. Every new vault is additive, not competitive. The protocol scales with the ecosystem.

## Solution: Economic Atomicity

FlashDot replaces transaction-level atomicity with **economic atomicity**:

> Before any funds move, the borrower locks a bond on Polkadot Hub that covers `principal + interest` for every participating vault. If repayment fails, the bond is slashed to make lenders whole — guaranteed on-chain.

This is implemented through a **2-Phase Commit protocol coordinated via XCM**:

```
Phase 1 — Prepare (Lock)
  Hub ──XCM Transact──► Vault A: prepare(loanId, amount)  → lock liquidity
  Hub ──XCM Transact──► Vault B: prepare(loanId, amount)  → lock liquidity
  Vault A ──XCM QueryResponse──► Hub: PreparedAck
  Vault B ──XCM QueryResponse──► Hub: PreparedAck

Phase 2 — Commit (Disburse)
  Hub ──XCM Transact──► Vault A: commit(loanId)  → send funds to borrower
  Hub ──XCM Transact──► Vault B: commit(loanId)  → send funds to borrower

Settlement
  Borrower repays each vault → bond returned
  — OR —
  No repay by expiry → bond slashed → each vault receives principal + interest
```

### What makes this work

| Mechanism | Purpose |
|---|---|
| **Bond Escrow** | Ceiling-division calculation ensures `bond >= Σ(principal × (1 + interest)) + fees`. Lenders are never short, even with rounding. |
| **2PC via XCM** | `prepare` locks funds without disbursing. `commit` only fires after all ACKs. No partial exposure without bond backing. |
| **RepayOnlyMode** | If some legs fail during commit, committed legs remain repayable while uncommitted legs are aborted. No funds get stuck. |
| **Deterministic Default** | After expiry, anyone can call `triggerDefault()`. Bond distribution is fully deterministic — no governance, no oracles. |
| **Idempotent Endpoints** | Every vault call (`prepare`, `commit`, `abort`) is safe to retry. XCM message duplication cannot cause double disbursement. |

## Architecture

```
┌──────────────────────────────────────────────────┐
│              Polkadot Hub (EVM)                   │
│                                                   │
│   FlashDotHub.sol                                │
│   ├── Loan State Machine (10 states)             │
│   ├── Bond Escrow (lock / slash / return)        │
│   └── XCM Proxy (xcmTransact + onXcmAck)        │
│                     │ XCM                         │
└─────────────────────┼────────────────────────────┘
          ┌───────────┴───────────┐
          ▼                       ▼
   FlashDotVault A         FlashDotVault B
   (Parachain EVM)         (Parachain EVM)
   ├── LP Pool             ├── LP Pool
   ├── prepare / commit    ├── prepare / commit
   ├── abort / repay       ├── abort / repay
   └── claimDefault        └── claimDefault

Off-chain:
   Coordinator (TypeScript) — watches Hub events, drives lifecycle
   Frontend (Next.js 14)   — single-signature UX, real-time status
```

### Loan State Machine

```
Created → Preparing → Prepared → Committing → Committed → Repaying → Settled
                                      │                        │
                                      └─ RepayOnlyMode ────────┘
                                                               │
                                              (expiry, no repay) → Defaulted
```

10 loan states, 8 leg states. Every transition is enforced on-chain with `require` guards.

## Smart Contracts

### FlashDotHub.sol (708 lines)

The Hub is the protocol's brain — it holds the bond, orchestrates XCM messages, and enforces all invariants.

**Key functions:**
- `createLoan(params, legSpecs)` — Lock bond, register loan and legs
- `startPrepare(loanId)` — Send XCM `prepare` to each vault
- `onXcmAck(queryId, success)` — Process prepare/commit ACKs from XCM executor
- `startCommit(loanId)` — Send XCM `commit` after all legs are prepared
- `enforceCommitTimeout(loanId)` — Enter RepayOnlyMode on partial commit failure
- `finalizeSettle(loanId)` — Return bond after all legs repaid (minus hub fee)
- `triggerDefault(loanId)` — Slash bond, pay committed vaults after expiry

### FlashDotVault.sol (285 lines)

Each vault manages an LP pool and implements the 2PC endpoint interface, callable only from the Hub's XCM sovereign account.

**Key functions:**
- `deposit(amount)` / `withdraw(shares)` — LP management with pro-rata share accounting
- `prepare(loanId, ...)` — Lock funds from `available` to `reserved`
- `commit(loanId)` — Move `reserved` to `borrowed`, transfer to borrower
- `abort(loanId)` — Release `reserved` back to `available`
- `repay(loanId, amount)` — Accept repayment, move `borrowed` back to `available`
- `claimDefault(loanId)` — Mark default after Hub pays bond directly

**Pool invariant enforced at all times:** `total == available + reserved + borrowed`

### XCM Integration

- `IXcmPrecompile` interface calls the Polkadot Hub XCM precompile (`0x0000...0800`)
- `XcmEncoder.sol` handles SCALE-encoding of `MultiLocation` and ABI-encoding of vault calls
- `onXcmAck()` callback processes `QueryResponse` from vaults to advance the state machine

## Protocol Invariants

These are non-negotiable guarantees enforced on-chain:

| # | Invariant | Enforcement |
|---|---|---|
| I-1 | Committed lender always receives `principal + interest` | `finalizeSettle` repay path + `triggerDefault` slash path |
| I-2 | `CommittedAcked` is irreversible — no rollback to `Aborted` | State guard in abort helper |
| I-3 | All vault endpoints are idempotent under duplication | Same-params no-op checks in prepare/commit/abort |
| I-4 | Bond covers worst-case obligation (all legs committed + all fees) | Ceiling-division math in `createLoan()` |
| I-5 | Only Hub XCM sovereign origin can call vault remote endpoints | `onlyHubOrigin` modifier |
| I-6 | Commit is single-execution per loan | `state == Prepared` guard |

## Coordinator Service

TypeScript service that automates the asynchronous loan lifecycle. **Permissionless by design** — anyone can run it; the Hub contract enforces all invariants regardless.

- Watches Hub events (`LoanCreated`, `PreparedAcked`, `CommittedAcked`, `RepayConfirmed`)
- Triggers state transitions (`startPrepare` → `startCommit` → `finalizeSettle`)
- Retry engine with exponential backoff (5 retries, 1s→60s)
- Timeout enforcer: cancels stuck loans, triggers RepayOnlyMode or default
- SQLite (Drizzle ORM) for state tracking and XCM event deduplication
- Prometheus metrics endpoint for monitoring

## Frontend

Next.js 14 application with single-signature UX:

1. **Connect** MetaMask to Polkadot Hub EVM
2. **Create** loan — select vaults, set amount/duration, preview bond calculation, sign once
3. **Track** real-time progress — per-leg XCM state, countdown timer, notifications
4. **Repay** committed legs or wait for automatic default settlement
5. **History** of all past loans with settlement outcomes

Additional: dark/light theme, mobile-responsive, settings panel, onboarding flow.

## Tech Stack

| Layer | Technology |
|---|---|
| Smart Contracts | Solidity 0.8.28, Hardhat, Foundry |
| Cross-chain Messaging | XCM Precompile, SCALE-encoded MultiLocation, QueryResponse ACK |
| Coordinator | TypeScript, ethers.js, SQLite + Drizzle ORM |
| Frontend | Next.js 14 (App Router), React Query, Tailwind CSS, ethers.js |
| Network | Polkadot Hub TestNet (Paseo), Chain ID 420420417 |
| Hosting | Vercel (frontend), Railway (coordinator) |

## Live Links

| Resource | URL |
|---|---|
| Frontend | https://flashdot.vercel.app |
| Coordinator Health | https://coordinator-production-1de8.up.railway.app/health |
| Source Code | https://github.com/StudioLIQ/flashdot-monorepo |

## Deployed Contracts (Polkadot Hub TestNet)

| Contract | Address |
|---|---|
| MockToken (wDOT) | `0xEB0AAED452428a9bE0414A00B2F001400c176d9D` |
| FlashDotHub | `0x27DBBFCCd6471b2e473cf424bc81219330e7279a` |
| FlashDotVault A | `0xc2b3F70A4B4BDE43E2c110EEC60d5688608cb71E` |
| FlashDotVault B | `0x509747fc2c2BaD594be37aA39031B322eEb4f73c` |

