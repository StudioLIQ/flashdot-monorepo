# FlashDot Demo Script

Target length: 3–5 minutes

## 0. Prerequisites

- Frontend live at <https://flashdot.vercel.app>
- Coordinator health OK: <https://coordinator-production-1de8.up.railway.app/health>
- MetaMask with Demo User wallet imported (PK in root `.env.example`)
- Network: Polkadot Hub TestNet · Chain ID `420420417`

## 1. Problem & Architecture (30s)

- Cross-chain flash loans cannot rely on single-transaction atomic revert.
- FlashDot uses bond-backed economic atomicity with Hub coordination + vault legs.
- Show the README architecture diagram — point out Hub, vaults, coordinator, frontend.

## 2. Happy Path (2m)

1. Open <https://flashdot.vercel.app> and connect MetaMask on Polkadot Hub TestNet.
2. Create a loan plan with Vault A + Vault B.
3. Show loan status moving through `Created → Preparing → Prepared → Committing → Committed`.
4. Repay committed legs.
5. Finalize settlement — bond returns to the borrower.

## 3. Failure Path (45–60s)

- Show `RepayOnlyMode` after a commit timeout or failed commit ACK.
- Explain that committed legs remain repayable while new commit progress is blocked.
- Optionally advance to expiry and trigger default to demonstrate deterministic bond payout.

## 4. Technical Proof Points (30s)

- Hardhat + Foundry dual test suites.
- Coordinator unit coverage and CI workflows.
- XCM encoder byte tests and timeout recovery paths.
- All contracts deployed and verified on Paseo testnet (block explorer link in README).

## 5. Submission Checklist

- Add the final demo video link to README and DORAHACKS.md before submission.
