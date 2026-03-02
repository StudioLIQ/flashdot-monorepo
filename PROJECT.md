# FlashDot — Bonded Cross-Chain Flash Loan Aggregator
**PROJECT.md — Hackathon Engineering Specification**
**Polkadot Solidity Hackathon APAC 2026 | Track 1 (EVM) + Track 2 (PVM/XCM)**

---

## 1) Executive Summary

**FlashDot** is the first bonded cross-chain flash loan aggregator on Polkadot Hub. It aggregates liquidity from multiple lending vaults across parachains via XCM, enabling borrowers to access large capital pools in a single Hub transaction.

### The Core Innovation: Economic Atomicity

Traditional flash loans are atomically reverted in one transaction. Cross-chain atomic revert is impossible by design. FlashDot solves this with **economic atomicity**:

> If funds are *committed* (disbursed) from any vault, the vault is guaranteed to receive **principal + interest** — either through borrower repayment or **bond slashing** on Hub.

This is achieved through:
- **Two-Phase Commit (2PC)** via Solidity contracts + XCM: `prepare` (lock) → `commit` (disburse)
- **Bond escrow** in `FlashDotHub.sol` with deterministic slash/payout on default
- **XCM precompile** on Polkadot Hub for cross-chain vault coordination
- **On-chain state machine** driven by XCM acknowledgement callbacks

### Hackathon Track Alignment

| Track | How FlashDot qualifies |
|---|---|
| **Track 1: EVM Smart Contracts** | `FlashDotHub.sol` + `FlashDotVault.sol` deployed on Polkadot Hub EVM; Solidity 2PC state machine; DeFi primitive |
| **Track 2: PVM / XCM Precompiles** | XCM Transact precompile for cross-chain vault calls; Polkadot-native asset (DOT) as bond and loan asset; XCM QueryResponse for ACK callbacks |

---

## 2) Problem Statement

### Why Cross-Chain Flash Loans Don't Exist (Yet)

| Constraint | Status Quo | FlashDot Solution |
|---|---|---|
| **Atomicity** | EVM flash loans revert same tx; impossible cross-chain | Economic atomicity via bond |
| **Liquidity depth** | Single-chain vaults are siloed | Aggregate across parachain vaults |
| **Trust** | Borrower could default cross-chain | Bond covers max committed obligation |
| **Coordination** | No standard cross-chain credit protocol | 2PC state machine + XCM |

### What This Unlocks

- **Large-capital DeFi strategies** across Polkadot parachains (arbitrage, liquidations, collateral swaps)
- **Single-signature UX**: borrower signs one `create_loan()` on Polkadot Hub; the protocol handles the rest
- **LP yields** across chains without bridge risk (vaults never leave their chain)

---

## 3) Architecture

### 3.1 Component Overview

```
┌─────────────────────────────────────────────────────┐
│                  Polkadot Hub (EVM)                  │
│                                                      │
│  ┌──────────────────────────────────────────────┐   │
│  │            FlashDotHub.sol                   │   │
│  │  ┌─────────────┐  ┌──────────┐  ┌────────┐  │   │
│  │  │ LoanManager │  │BondEscrow│  │XCMProxy│  │   │
│  │  │ (2PC state  │  │(lock/    │  │(XCM    │  │   │
│  │  │  machine)   │  │slash/pay)│  │precomp)│  │   │
│  │  └─────────────┘  └──────────┘  └────────┘  │   │
│  └──────────────────────────────────────────────┘   │
│                        │ XCM                         │
└────────────────────────┼────────────────────────────┘
                         │
        ┌────────────────┴────────────────┐
        │                                 │
        ▼                                 ▼
┌───────────────┐                ┌────────────────┐
│  Vault A      │                │   Vault B      │
│  Parachain    │                │   Parachain    │
│               │                │                │
│ FlashDotVault │                │ FlashDotVault  │
│  .sol (EVM)   │                │  .sol (EVM)    │
│               │                │                │
│ LP Pool       │                │ LP Pool        │
│ prepare()     │                │ prepare()      │
│ commit()      │                │ commit()       │
│ abort()       │                │ abort()        │
│ repay()       │                │ repay()        │
└───────────────┘                └────────────────┘

Off-chain:
┌──────────────────────────────────────────────────┐
│  Coordinator (TypeScript)                         │
│  watches Hub events → triggers extrinsics/calls   │
│  retry logic, timeout enforcement, repay-only mode │
└──────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────┐
│  Frontend (Next.js + ethers.js + polkadot-api)    │
│  one-signature UX → real-time loan status         │
└──────────────────────────────────────────────────┘
```

### 3.2 Chain Topology (MVP)

| Chain | Role | Runtime |
|---|---|---|
| Polkadot Hub | Hub contract deployment, XCM origin | EVM (Polkadot Hub testnet) |
| Vault A | Lending vault, LP pool | EVM-compatible parachain |
| Vault B | Lending vault, LP pool | EVM-compatible parachain |

> **Hackathon simplification**: For demo, Vault A and B can be deployed on Polkadot Hub EVM as separate contracts simulating multi-vault, with XCM precompile calls used for the real cross-chain story.

---

## 4) Protocol Design

### 4.1 Loan Lifecycle

```
Borrower
  │
  ▼ create_loan(legs, expiry) + bond DOT
[Created]
  │
  ▼ start_prepare()  [Coordinator or permissionless]
[Preparing] ──── XCM → Vault A: prepare(loan_id, amount)
           ──── XCM → Vault B: prepare(loan_id, amount)
  │
  ├── ACK from A ─→ Leg A: PreparedAcked
  ├── ACK from B ─→ Leg B: PreparedAcked
  │
  ▼ (enough legs prepared)
[Prepared]
  │
  ▼ start_commit()
[Committing] ─── XCM → Vault A: commit(loan_id)  → disburse funds
             ─── XCM → Vault B: commit(loan_id)  → disburse funds
  │
  ├── ACK from A ─→ Leg A: CommittedAcked
  ├── ACK from B ─→ Leg B: CommittedAcked
  │
  ▼ (all committed)
[Committed] ──── Borrower uses funds for strategy ────
  │
  ▼ Borrower repay()
[Repaying] ──── Vault A repay confirmed
           ──── Vault B repay confirmed
  │
  ▼ finalize_settle()
[Settled] ──── Bond returned to borrower (minus fees)

──── OR (default path) ────

[Committed] ── expiry passes, no repay
  │
  ▼ trigger_default()
[Defaulted] ── Bond slashed → paid to each committed vault (principal + interest)
```

### 4.2 Two-Phase Commit (2PC)

**Phase 1 — Prepare (Lock)**
- Hub sends XCM `Transact` to each vault: `prepare(loan_id, amount, repay_amount, expiry)`
- Vault checks liquidity, locks funds (`available → reserved`)
- Vault emits XCM QueryResponse ACK back to Hub

**Phase 2 — Commit (Disburse)**
- Hub (after enough PreparedAcks) sends XCM `Transact`: `commit(loan_id)`
- Vault moves `reserved → borrowed`, transfers funds to `borrower_dest`
- Vault sends CommittedAck back to Hub

**Failure paths:**
- Prepare fail → abort all prepared legs → return bond minus fees
- Partial commit → Repay-Only Mode → borrower repays committed legs or bond pays at expiry

### 4.3 Economic Atomicity via Bond

```
bond_required = Σ(principal_i × (1 + interest_bps/10000)) + Σ(fee_budget_i) + hub_fee_buffer
```

Bond is denominated in the same asset as the loan (DOT for MVP). This eliminates oracle risk entirely.

On default:
- Hub slashes `bond_amount`
- Pays each committed leg: `principal_i + interest_i`
- Returns remainder to borrower

### 4.4 Partial Commit Handling

If any leg is `CommittedAcked` but total committed < target within `commit_timeout`:
- Enter **Repay-Only Mode** (irreversible flag)
- Abort all remaining prepared (not committed) legs
- Borrower must repay committed legs
- At expiry: bond pays committed legs if not repaid

---

## 5) Smart Contract Specification

### 5.1 `FlashDotHub.sol`

**Storage:**
```solidity
mapping(uint256 => Loan) public loans;           // loanId => Loan
mapping(uint256 => mapping(uint256 => Leg)) legs; // loanId => legId => Leg
mapping(uint256 => BondInfo) public bondEscrow;   // loanId => BondInfo
mapping(bytes32 => QueryMeta) queryIndex;         // xcmQueryId => meta
uint256 public nextLoanId;
```

**Data Structures:**
```solidity
struct Loan {
    address borrower;
    address asset;          // ERC-20 asset (DOT wrapped)
    uint256 targetAmount;
    uint32  interestBps;
    uint64  createdAt;      // unix ms
    uint64  expiryAt;
    LoanState state;
    bool    repayOnlyMode;
    bytes32 planHash;
}

enum LoanState {
    Created, Preparing, Prepared, Committing,
    Committed, Repaying, Settling, Settled,
    Aborted, Defaulted
}

struct Leg {
    bytes32 chain;          // XCM MultiLocation hash
    address vault;          // vault contract address on remote chain
    uint256 amount;
    uint256 feeBudget;
    uint32  legInterestBps;
    LegState state;
}

enum LegState {
    Init, PrepareSent, PreparedAcked, CommitSent,
    CommittedAcked, RepaidConfirmed, Aborted, DefaultPaid
}

struct BondInfo {
    uint256 bondAmount;
    uint64  lockedAt;
    bool    slashed;
}
```

**External Functions:**
```solidity
// User-facing
function createLoan(LoanParams calldata params, LegSpec[] calldata legSpecs) external returns (uint256 loanId);
function cancelBeforeCommit(uint256 loanId) external;

// Coordinator-facing (permissionless)
function startPrepare(uint256 loanId) external;
function startCommit(uint256 loanId) external;
function finalizeSettle(uint256 loanId) external;
function triggerDefault(uint256 loanId) external;

// XCM callback (called by XCM precompile on ACK)
function onXcmAck(bytes32 queryId, bool success) external onlyXcmExecutor;

// Emergency (governance)
function pauseCreate(bool paused) external onlyOwner;
function pauseCommit(bool paused) external onlyOwner;
function setSupportedChains(bytes32[] calldata chains) external onlyOwner;
```

**Events:**
```solidity
event LoanCreated(uint256 indexed loanId, address borrower, address asset, uint256 targetAmount, uint256 bondAmount);
event PrepareSent(uint256 indexed loanId, uint256 legId, bytes32 chain, uint256 amount);
event PreparedAcked(uint256 indexed loanId, uint256 legId, bytes32 chain);
event CommitSent(uint256 indexed loanId, uint256 legId, bytes32 chain, uint256 amount);
event CommittedAcked(uint256 indexed loanId, uint256 legId, bytes32 chain);
event RepayConfirmed(uint256 indexed loanId, uint256 legId, uint256 amount);
event LoanAborted(uint256 indexed loanId, string reason);
event RepayOnlyMode(uint256 indexed loanId, string reason);
event LoanDefaulted(uint256 indexed loanId, uint256 slashedAmount);
event LoanSettled(uint256 indexed loanId, uint256 hubFee);
```

**XCM Integration (Polkadot Hub Precompile):**
```solidity
interface IXcmPrecompile {
    // Polkadot Hub XCM precompile (address: 0x0000...0800 or equivalent)
    function xcmTransact(
        bytes calldata dest,        // encoded MultiLocation
        bytes calldata call,        // encoded runtime call
        uint64 weight,
        bytes32 queryId,            // for QueryResponse tracking
        bytes calldata callbackDest // Hub location for ACK
    ) external payable returns (bool);
}
```

### 5.2 `FlashDotVault.sol`

**Storage:**
```solidity
mapping(uint256 => VaultLoan) public vaultLoans;   // loanId => VaultLoan
mapping(address => uint256) public lpShares;        // LP share tracking
PoolState public pool;                              // { total, available, borrowed, reserved }
IERC20 public asset;
address public hubLocation;                         // authorized Hub origin (XCM sovereign)
```

**Data Structures:**
```solidity
struct VaultLoan {
    uint256 principal;
    uint256 repayAmount;
    uint64  expiryAt;
    address borrowerDest;   // where to send committed funds
    bytes32 hubLoc;         // XCM location for callbacks
    VaultLoanState state;
}

enum VaultLoanState { Prepared, Committed, Repaid, Aborted, DefaultClaimed }

struct PoolState {
    uint256 total;
    uint256 available;
    uint256 borrowed;
    uint256 reserved;
}
```

**External Functions:**
```solidity
// LP management (local only)
function deposit(uint256 amount) external returns (uint256 shares);
function withdraw(uint256 shares) external returns (uint256 amount);

// Vault endpoint calls (only callable from Hub XCM origin)
function prepare(uint256 loanId, uint256 principal, uint256 repayAmount, uint64 expiryAt, address borrowerDest, bytes32 hubLoc) external onlyHubOrigin;
function commit(uint256 loanId) external onlyHubOrigin;
function abort(uint256 loanId) external onlyHubOrigin;

// Repay (open — borrower calls directly or via Hub)
function repay(uint256 loanId, uint256 amount) external;

// Default claim (permissionless after expiry)
function claimDefault(uint256 loanId) external;
```

**Idempotency Rules:**
```solidity
// prepare: same params → no-op success; different params → revert
// commit: already committed → no-op success
// abort: after commit → revert (cannot unlock after disburse)
// repay: after repaid → accept up to cap, record excess
```

---

## 6) Protocol Invariants (Non-negotiable)

| # | Invariant | Where enforced |
|---|---|---|
| I-1 | Committed lender receives `principal + interest` (repay or bond) | Hub slash/payout logic |
| I-2 | Commit is one-way: `CommittedAcked` → no transition back | LoanManager state machine |
| I-3 | All vault endpoint calls are idempotent under duplication | Vault contract `require` guards |
| I-4 | Bond ≥ sum of max committed repay obligations + all fee budgets | `createLoan()` validation |
| I-5 | Only Hub XCM sovereign origin can call `prepare/commit/abort` | `onlyHubOrigin` modifier |
| I-6 | Disbursement per `loanId` is single-execution | `state == Prepared` check in `commit()` |

---

## 7) Coordinator Service

### 7.1 Purpose
Automate the asynchronous multi-chain loan lifecycle. Permissionless by design — anyone can run it; Hub contract enforces all invariants on-chain.

### 7.2 Tech Stack
- **Language**: TypeScript
- **Chain RPC**: `polkadot-api` (PAPI) + `ethers.js` for EVM calls
- **DB**: SQLite (Drizzle ORM) for loan state + retry tracking
- **Subscriptions**: WebSocket subscriptions to Hub EVM events

### 7.3 Policy Implementation
```typescript
// Retry config
const RETRY_CONFIG = {
  maxRetries: 5,
  backoffMs: [1000, 2000, 5000, 15000, 60000],
};

// Timeout thresholds
const TIMEOUTS = {
  prepareTimeoutMs: 120_000,   // 2 min
  commitTimeoutMs:  120_000,   // 2 min
  defaultCheckMs:   10_000,    // poll interval
};

// Lifecycle handlers
async function onLoanCreated(loanId: bigint): Promise<void>;
async function onPreparedAck(loanId: bigint, legId: bigint): Promise<void>;
async function onCommittedAck(loanId: bigint, legId: bigint): Promise<void>;
async function checkExpiredLoans(): Promise<void>;
```

---

## 8) Frontend Specification

### 8.1 Tech Stack
- **Framework**: Next.js 14 (App Router)
- **Wallet**: `ethers.js` + MetaMask (EVM) + `polkadot-api` for XCM status
- **Styling**: Tailwind CSS
- **State**: React Query for loan state polling

### 8.2 UX Flow (Single-Signature)
1. Connect MetaMask to Polkadot Hub (EVM)
2. Select asset (DOT), target amount, duration, vault legs
3. Preview: computed bond, per-leg interest, fee estimates
4. **Sign one transaction**: `createLoan()` with bond locked
5. Live progress tracker:
   - Per-leg `PrepareSent` → `PreparedAcked` → `CommitSent` → `CommittedAcked`
   - Repay instruction with countdown timer
   - Repay-Only Mode banner if triggered
6. Settlement: bond returned / slashed, net outcome summary

---

## 9) Security & Threat Model

### 9.1 Primary Threats

| Threat | Mitigation |
|---|---|
| Partial commit ambiguity | Repay-Only Mode; deterministic bond payout to committed legs |
| XCM replay / duplicate calls | Idempotency guards on all vault state transitions |
| Fee starvation | Per-leg `feeBudget` checked before commit; Hub refuses if insufficient |
| Origin spoofing | `onlyHubOrigin` modifier using XCM sovereign account derivation |
| Accounting bugs | Pool invariant checks: `total == available + reserved + borrowed` |
| Coordinator abuse | Coordinator only triggers on-chain calls; Hub enforces all state rules |
| Bond math underflow | Bond must cover worst-case (all legs committed + all fees); checked in `createLoan()` |

### 9.2 XCM Origin Verification (Polkadot Hub)
```solidity
modifier onlyHubOrigin() {
    // Polkadot Hub computes XCM sovereign account for the Hub chain
    // Only this address can call vault endpoints
    require(msg.sender == hubSovereignAccount, "unauthorized: not Hub XCM origin");
    _;
}
```

---

## 10) Testing Plan

### 10.1 Unit Tests (Hardhat / Foundry)
- `FlashDotHub`: bond calculation, state machine transitions, ACK handler idempotency, default payout math
- `FlashDotVault`: prepare/commit/abort/repay invariants, pool accounting, claim_default

### 10.2 Integration Tests (Local testnet)
**Tooling**: Zombienet (relay + Polkadot Hub + 2 vault parachains)

| # | Scenario | Expected outcome |
|---|---|---|
| 1 | Happy path | prepare → commit → repay → settle → bond returned |
| 2 | Prepare failure | VaultB rejects → VaultA aborted → bond returned |
| 3 | Partial commit | VaultA commits, VaultB fails → repay-only → borrower repays → settle |
| 4 | Default | commit succeeds → no repay → expiry → bond slashed → vaults paid |
| 5 | Delayed ACK | late ACK → coordinator retry → idempotency prevents double action |

---

## 11) Milestones (Hackathon Timeline)

| Milestone | Scope | Target |
|---|---|---|
| **M0** | Repo scaffold, Hardhat config, Zombienet local testnet | Day 1-2 |
| **M1** | `FlashDotVault.sol` — pool accounting + all endpoint calls + unit tests | Day 3-5 |
| **M2** | `FlashDotHub.sol` — state machine + bond escrow + XCM send stubs + unit tests | Day 5-8 |
| **M3** | XCM wiring — precompile integration, Zombienet E2E, 5 scenarios passing | Day 9-13 |
| **M4** | Coordinator (TS) + Frontend (Next.js) + demo video | Day 14-17 |
| **M5** | Hardening, security checklist, README, submission | Day 17-18 |

---

## 12) Non-Goals (MVP)

- True single-transaction cross-chain atomic revert
- Multi-asset borrowing / oracle-based collateralization
- Ultra-low-latency MEV (XCM latency makes this low EV)
- Permissionless arbitrary remote execution
- Mainnet deployment (requires partner chain agreements)

---

## 13) Deliverable Checklist

- [ ] `FlashDotHub.sol` — all extrinsics, storage, events, XCM send + ACK
- [ ] `FlashDotVault.sol` — pool accounting, idempotent endpoints, claimDefault
- [ ] Hardhat/Foundry unit tests for both contracts
- [ ] Zombienet local testnet config (relay + Hub + VaultA + VaultB)
- [ ] 5 integration test scenarios passing deterministically
- [ ] Coordinator TypeScript service (retry + timeout + repay-only policy)
- [ ] Frontend (Next.js) — one-signature UX + live progress tracker
- [ ] README with architecture, quick-start, demo video link
- [ ] Security checklist + configuration guide

---

## 14) Appendix: Message Flow (ASCII)

### Happy Path
```
Borrower ──create_loan()+bond──► Hub
Hub ──XCM prepare──► VaultA
Hub ──XCM prepare──► VaultB
VaultA ──ACK PreparedAck──► Hub
VaultB ──ACK PreparedAck──► Hub
Hub ──XCM commit──► VaultA  ──funds──► Borrower
Hub ──XCM commit──► VaultB  ──funds──► Borrower
Borrower ──repay()──► VaultA, VaultB
Hub ──finalize_settle()──► Hub (bond returned - fees)
```

### Default Path
```
[Committed legs exist]
[expiry passes, no repay]
Coordinator / anyone ──trigger_default(loan_id)──► Hub
Hub: slash bond → pay VaultA(repay_amount_A) + VaultB(repay_amount_B)
Hub: return remainder to borrower
Hub: LoanDefaulted event emitted
```
