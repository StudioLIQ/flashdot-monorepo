# FlashDot Security Checklist

## Protocol Invariants (I-1 ~ I-6)

- I-1 committed lender receives `principal + interest` (repay or bond payout)
  - Repay path accounting: `contracts/contracts/FlashDotVault.sol:210`, `contracts/contracts/FlashDotVault.sol:220`, `contracts/contracts/FlashDotVault.sol:222`
  - Default payout path: `contracts/contracts/FlashDotHub.sol:424`, `contracts/contracts/FlashDotHub.sol:428`, `contracts/contracts/FlashDotHub.sol:432`

- I-2 `CommittedAcked` is one-way (no rollback to `Aborted`)
  - Commit ACK promotion: `contracts/contracts/FlashDotHub.sol:357`
  - Abort helper only targets non-committed states: `contracts/contracts/FlashDotHub.sol:368`

- I-3 vault endpoints are idempotent
  - `prepare` same-params no-op: `contracts/contracts/FlashDotVault.sol:129`
  - `commit` already committed no-op: `contracts/contracts/FlashDotVault.sol:167`
  - `abort` already aborted no-op: `contracts/contracts/FlashDotVault.sol:190`

- I-4 `bond >= Σ(repayAmounts) + Σ(feeBudgets)`
  - Bond computed at create: `contracts/contracts/FlashDotHub.sol:130`
  - Ceiling-division bond math: `contracts/contracts/FlashDotHub.sol:504`
  - Runtime assertion before slash completion: `contracts/contracts/FlashDotHub.sol:438`

- I-5 only Hub-origin can call remote vault endpoints
  - Access-control modifier: `contracts/contracts/FlashDotVault.sol:50`
  - Guarded endpoints: `contracts/contracts/FlashDotVault.sol:125`, `contracts/contracts/FlashDotVault.sol:164`, `contracts/contracts/FlashDotVault.sol:187`

- I-6 single commit execution per loan
  - Commit entry requires prepared state: `contracts/contracts/FlashDotHub.sol:313`
  - Commit can only be started once by state progression (`Prepared -> Committing`): `contracts/contracts/FlashDotHub.sol:315`

## Reentrancy and State-Change Guards

- Hub
  - `finalizeSettle` uses `nonReentrant`: `contracts/contracts/FlashDotHub.sol:383`
  - `triggerDefault` uses `nonReentrant`: `contracts/contracts/FlashDotHub.sol:406`

- Vault
  - State-changing functions use `nonReentrant`: `deposit` (`contracts/contracts/FlashDotVault.sol:71`), `withdraw` (`contracts/contracts/FlashDotVault.sol:94`), `prepare` (`contracts/contracts/FlashDotVault.sol:125`), `commit` (`contracts/contracts/FlashDotVault.sol:164`), `abort` (`contracts/contracts/FlashDotVault.sol:187`), `repay` (`contracts/contracts/FlashDotVault.sol:210`), `claimDefault` (`contracts/contracts/FlashDotVault.sol:232`)

## Arithmetic and Overflow Notes

- Ceiling division is applied consistently in both bond and repay math
  - Bond: `contracts/contracts/FlashDotHub.sol:508`
  - Default repay per leg: `contracts/contracts/FlashDotHub.sol:427`

- `unchecked` is only used for loop index increments in bounded loops (`i < nLegs`), not for value-carrying financial arithmetic.

## Access Control and Pausability

- `onlyOwner` controls pause and governance parameters: `contracts/contracts/FlashDotHub.sol:455`, `contracts/contracts/FlashDotHub.sol:459`, `contracts/contracts/FlashDotHub.sol:463`
- `pauseCreate`/`pauseCommit` do not block repay/default paths (no pause checks in vault repay/default or hub triggerDefault/finalizeSettle).

## Verification Commands

- `pnpm -C contracts test`
- `pnpm -C contracts test:forge`
