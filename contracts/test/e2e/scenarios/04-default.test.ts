/**
 * E2E Scenario 4: Default
 * commit succeeds → no repay → expiry → bond slashed → vaults paid
 */

import { expect } from "chai";
import { ethers } from "ethers";
import { setupE2E } from "../setup.js";
import { waitForLoanState } from "../../../zombienet/scripts/helpers/wait-for-xcm.js";

const LoanState = { Defaulted: 9 };

describe("E2E Scenario 4: Default", function () {
  this.timeout(300_000);

  it("commit succeeds → no repay → expiry → triggerDefault → bond slashed", async () => {
    const { hub, vaultA, token, deps } = await setupE2E();
    console.log("TODO: implement scenario 4 — requires fast-forward time on Zombienet");
    // Requires: mine blocks until expiryAt, then call triggerDefault
    // Platform limitation: Zombienet doesn't easily support time manipulation
  });
});
