/**
 * E2E Scenario 2: Prepare Failure
 * VaultB rejects prepare → VaultA aborted → bond returned
 */

import { expect } from "chai";
import { ethers } from "ethers";
import { setupE2E } from "../setup.js";
import { waitForLoanState } from "../../../zombienet/scripts/helpers/wait-for-xcm.js";

const LoanState = { Aborted: 8 };

describe("E2E Scenario 2: Prepare Failure", function () {
  this.timeout(300_000);

  it("prepare failure on VaultB → all aborted → bond returned", async () => {
    const { hub, vaultA, token, signer } = await setupE2E();

    // Drain VaultB so prepare fails (insufficient liquidity)
    // VaultA has enough, VaultB has 0 → VaultB prepare will fail
    const LP_AMOUNT = ethers.parseEther("5000");
    await token.approve(await vaultA.getAddress(), ethers.MaxUint256);
    await vaultA.deposit(LP_AMOUNT);
    // VaultB has 0 liquidity — prepare will fail

    const CHAIN_A = ethers.keccak256(ethers.toUtf8Bytes("parachain-2000"));
    const CHAIN_B = ethers.keccak256(ethers.toUtf8Bytes("parachain-2001"));
    const now = Math.floor(Date.now() / 1000);

    const params = {
      asset: await token.getAddress(),
      targetAmount: ethers.parseEther("6000"),
      interestBps: 100,
      expiryAt: now + 3600,
    };
    const legs = [
      { chain: CHAIN_A, vault: await vaultA.getAddress(), amount: ethers.parseEther("1000"), feeBudget: 0, legInterestBps: 100 },
      { chain: CHAIN_B, vault: "0x0000000000000000000000000000000000000000", amount: ethers.parseEther("5000"), feeBudget: 0, legInterestBps: 100 }, // invalid vault
    ];

    await token.approve(await hub.getAddress(), ethers.MaxUint256);
    await hub.createLoan(params, legs);
    const balBefore = await token.balanceOf(signer.address);

    await hub.startPrepare(1n);

    // Wait for Aborted state (prepare failure triggers abort)
    await waitForLoanState(hub, 1n, LoanState.Aborted, { timeoutMs: 120_000 });

    const balAfter = await token.balanceOf(signer.address);
    expect(balAfter).to.be.gt(balBefore, "Bond returned after prepare failure");
    console.log("✓ Scenario 2: Prepare failure handled correctly");
  });
});
