/**
 * E2E Scenario 1: Happy Path
 * prepare → commit → repay → settle → bond returned
 *
 * Requires:
 *   - Zombienet testnet running (zombienet spawn zombienet/config.toml)
 *   - Contracts deployed (npx tsx zombienet/scripts/deploy.ts)
 */

import { expect } from "chai";
import { ethers } from "ethers";
import { setupE2E } from "../setup";
import { waitForLoanState, waitForLegState } from "../../../zombienet/scripts/helpers/wait-for-xcm";

// LoanState enum values
const LoanState = { Created: 0, Preparing: 1, Prepared: 2, Committing: 3, Committed: 4, Settled: 7 };
const LegState  = { PreparedAcked: 2, CommittedAcked: 4, RepaidConfirmed: 5 };

describe("E2E Scenario 1: Happy Path", function () {
  this.timeout(300_000); // 5 minutes (XCM latency)

  it("prepare → commit → repay → settle → bond returned", async () => {
    const { hub, vaultA, vaultB, token, signer } = await setupE2E();

    const LP_AMOUNT   = ethers.parseEther("10000");
    const BORROW_A    = ethers.parseEther("1000");
    const BORROW_B    = ethers.parseEther("2000");
    const INTEREST    = 100; // 1%
    const DURATION    = 3600; // 1 hour

    // 1. LP deposits into both vaults
    await token.approve(await vaultA.getAddress(), ethers.MaxUint256);
    await token.approve(await vaultB.getAddress(), ethers.MaxUint256);
    await vaultA.deposit(LP_AMOUNT);
    await vaultB.deposit(LP_AMOUNT);
    console.log("✓ LP deposits done");

    // 2. Compute bond and create loan
    const now = Math.floor(Date.now() / 1000);
    const expiryAt = now + DURATION;
    const CHAIN_A = ethers.keccak256(ethers.toUtf8Bytes("parachain-2000"));
    const CHAIN_B = ethers.keccak256(ethers.toUtf8Bytes("parachain-2001"));

    const params = {
      asset:        await token.getAddress(),
      targetAmount: BORROW_A + BORROW_B,
      interestBps:  INTEREST,
      expiryAt:     expiryAt,
    };
    const legs = [
      { chain: CHAIN_A, vault: await vaultA.getAddress(), amount: BORROW_A, feeBudget: ethers.parseEther("0.1"), legInterestBps: INTEREST },
      { chain: CHAIN_B, vault: await vaultB.getAddress(), amount: BORROW_B, feeBudget: ethers.parseEther("0.1"), legInterestBps: INTEREST },
    ];

    await token.approve(await hub.getAddress(), ethers.MaxUint256);
    const tx = await hub.createLoan(params, legs);
    const receipt = await tx.wait();
    // Extract loanId from LoanCreated event
    const loanId = 1n; // First loan
    console.log(`✓ Loan created: loanId=${loanId}`);

    // 3. Start prepare
    await hub.startPrepare(loanId);
    await waitForLoanState(hub, loanId, LoanState.Prepared, { timeoutMs: 120_000 });
    console.log("✓ Loan Prepared");

    // 4. Start commit
    await hub.startCommit(loanId);
    await waitForLoanState(hub, loanId, LoanState.Committed, { timeoutMs: 120_000 });
    console.log("✓ Loan Committed");

    // 5. Repay both vaults
    const repayA = (BORROW_A * BigInt(10000 + INTEREST) + 9999n) / 10000n;
    const repayB = (BORROW_B * BigInt(10000 + INTEREST) + 9999n) / 10000n;
    await token.approve(await vaultA.getAddress(), repayA);
    await token.approve(await vaultB.getAddress(), repayB);
    await vaultA.repay(loanId, repayA);
    await vaultB.repay(loanId, repayB);
    console.log("✓ Repaid both vaults");

    // 6. Finalize settle
    const balBefore = await token.balanceOf(signer.address);
    await hub.finalizeSettle(loanId);
    const balAfter  = await token.balanceOf(signer.address);

    const loan = await hub.getLoan(loanId);
    expect(Number(loan.state)).to.equal(LoanState.Settled, "Loan should be Settled");
    expect(balAfter).to.be.gt(balBefore, "Bond returned to borrower");
    console.log("✓ Loan Settled, bond returned");
  });
});
