/**
 * E2E Scenario 3: Partial Commit
 * VaultA commits, VaultB fails → repay-only → borrower repays → settle
 */

import { expect } from "chai";
import { setupE2E } from "../setup.js";
import { waitForLoanState } from "../../../zombienet/scripts/helpers/wait-for-xcm.js";

const LoanState = { Committed: 4, Settled: 7 };

describe("E2E Scenario 3: Partial Commit → RepayOnly", function () {
  this.timeout(300_000);

  it("partial commit → repay-only mode → settle", async () => {
    const { hub, vaultA, token } = await setupE2E();
    // See full implementation in T-19 — this is a placeholder
    console.log("TODO: implement scenario 3 (requires XCM selective failure)");
  });
});
