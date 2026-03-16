# FlashDot Demo Script

Target length: 3 to 5 minutes

## 1. Problem and Architecture (30s)

- Cross-chain flash loans cannot rely on single-transaction atomic revert.
- FlashDot uses bond-backed economic atomicity with Hub coordination plus vault legs.
- Show the README architecture diagram and point out Hub, vaults, coordinator, frontend.

## 2. Happy Path (2m)

1. Start local stack or Zombienet deployment.
2. Open frontend and connect MetaMask on Polkadot Hub EVM.
3. Create a loan plan with Vault A + Vault B.
4. Show loan status moving through `Created -> Preparing -> Prepared -> Committing -> Committed`.
5. Repay committed legs.
6. Finalize settlement and show the bond returning to the borrower.

## 3. Failure Path (45s to 60s)

- Show `RepayOnlyMode` after a commit timeout or failed commit ACK.
- Explain that committed legs remain repayable while new commit progress is blocked.
- Optionally advance to expiry and trigger default to demonstrate deterministic bond payout.

## 4. Technical Proof Points (30s)

- Mention Hardhat + Foundry contract test suites.
- Mention coordinator unit coverage and CI workflows for frontend build plus E2E.
- Mention known-good XCM encoder byte tests and timeout recovery paths.

## 5. Submission Checklist

- Replace the README demo section with the final Loom or YouTube URL.
- Keep one uncut recording for judges and one shorter highlight clip if time permits.
