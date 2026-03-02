import { expect } from "chai";
import { ethers } from "hardhat";
import { FlashDotHub, ERC20Mock } from "../../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-toolbox/network-helpers";

describe("FlashDotHub", () => {
  let hub: FlashDotHub;
  let token: ERC20Mock;
  let owner: SignerWithAddress;
  let xcmExecutor: SignerWithAddress;
  let feeRecipient: SignerWithAddress;
  let borrower: SignerWithAddress;
  let stranger: SignerWithAddress;

  const CHAIN_A = ethers.keccak256(ethers.toUtf8Bytes("chain-a"));
  const CHAIN_B = ethers.keccak256(ethers.toUtf8Bytes("chain-b"));
  const VAULT_A = "0x000000000000000000000000000000000000A111";
  const VAULT_B = "0x000000000000000000000000000000000000B111";

  const PRINCIPAL = ethers.parseEther("100000");
  const INTEREST_BPS = 100n; // 1%
  const DURATION = 86400n; // 1 day

  async function deployContracts() {
    [owner, xcmExecutor, feeRecipient, borrower, stranger] = await ethers.getSigners();

    const ERC20MockFactory = await ethers.getContractFactory("ERC20Mock");
    token = (await ERC20MockFactory.deploy("Mock DOT", "DOT", 18)) as ERC20Mock;

    const MockXcmFactory = await ethers.getContractFactory("MockXcmPrecompile");
    const mockXcm = await MockXcmFactory.deploy(ethers.ZeroAddress);

    const HubFactory = await ethers.getContractFactory("FlashDotHub");
    hub = (await HubFactory.deploy(xcmExecutor.address, feeRecipient.address, await mockXcm.getAddress())) as FlashDotHub;
    // Fund hub for XCM fee forwarding
    await xcmExecutor.sendTransaction({ to: await hub.getAddress(), value: ethers.parseEther("10") });

    await token.mint(borrower.address, ethers.parseEther("10000000"));
    await token.connect(borrower).approve(await hub.getAddress(), ethers.MaxUint256);
  }

  async function makeLoanParams() {
    const now = BigInt(await time.latest());
    return {
      asset: await token.getAddress(),
      targetAmount: PRINCIPAL,
      interestBps: Number(INTEREST_BPS),
      expiryAt: now + DURATION,
    };
  }

  async function makeSingleLeg() {
    return [
      {
        chain: CHAIN_A,
        vault: VAULT_A,
        amount: PRINCIPAL,
        feeBudget: 0n,
        legInterestBps: Number(INTEREST_BPS),
      },
    ];
  }

  async function createLoan() {
    const params = await makeLoanParams();
    const legs = await makeSingleLeg();
    const tx = await hub.connect(borrower).createLoan(params, legs);
    const receipt = await tx.wait();
    const event = receipt?.logs.find((l) => {
      try {
        hub.interface.parseLog(l as any);
        return true;
      } catch {
        return false;
      }
    });
    return 1n; // first loan is always 1
  }

  function extractQueryIds(receipt: any, eventName: string): string[] {
    const qids: string[] = [];
    for (const log of receipt.logs) {
      try {
        const parsed = hub.interface.parseLog(log as any);
        if (parsed?.name === eventName) {
          // queryId is last arg
          const args = parsed.args;
          qids.push(args[args.length - 1] as string);
        }
      } catch {}
    }
    return qids;
  }

  beforeEach(async () => {
    await deployContracts();
  });

  // ──────────────────────────────────────────────────────────────────
  // createLoan
  // ──────────────────────────────────────────────────────────────────

  describe("createLoan", () => {
    it("creates loan and locks bond", async () => {
      const params = await makeLoanParams();
      const legs = await makeSingleLeg();
      const hubBefore = await token.balanceOf(await hub.getAddress());

      await expect(hub.connect(borrower).createLoan(params, legs))
        .to.emit(hub, "LoanCreated")
        .withArgs(1n, borrower.address, await token.getAddress(), PRINCIPAL, (v: bigint) => v > 0n);

      const loan = await hub.getLoan(1n);
      expect(loan.borrower).to.equal(borrower.address);
      expect(loan.state).to.equal(0n); // Created

      const hubAfter = await token.balanceOf(await hub.getAddress());
      expect(hubAfter).to.be.gt(hubBefore);
    });

    it("reverts with EXPIRY_TOO_SOON", async () => {
      const now = BigInt(await time.latest());
      const params = {
        asset: await token.getAddress(),
        targetAmount: PRINCIPAL,
        interestBps: Number(INTEREST_BPS),
        expiryAt: now + 1n,
      };
      await expect(hub.connect(borrower).createLoan(params, await makeSingleLeg()))
        .to.be.revertedWith("EXPIRY_TOO_SOON");
    });

    it("reverts with NO_LEGS", async () => {
      await expect(hub.connect(borrower).createLoan(await makeLoanParams(), []))
        .to.be.revertedWith("NO_LEGS");
    });

    it("reverts with CREATE_PAUSED", async () => {
      await hub.pauseCreate(true);
      await expect(hub.connect(borrower).createLoan(await makeLoanParams(), await makeSingleLeg()))
        .to.be.revertedWith("CREATE_PAUSED");
    });

    it("bond uses ceiling division", async () => {
      const legs = [
        {
          chain: CHAIN_A,
          vault: VAULT_A,
          amount: 1n, // 1 wei — extreme edge case
          feeBudget: 0n,
          legInterestBps: 1,
        },
      ];
      const params = {
        asset: await token.getAddress(),
        targetAmount: 1n,
        interestBps: 1,
        expiryAt: BigInt(await time.latest()) + DURATION,
      };
      await hub.connect(borrower).createLoan(params, legs);
      const bond = await hub.getBondInfo(1n);
      // repayAmt = ceil(1 * 10001 / 10000) = 2 (ceiling), + HUB_FEE_BUFFER
      expect(bond.bondAmount).to.be.gt(1n);
    });
  });

  // ──────────────────────────────────────────────────────────────────
  // State Machine: Created → Preparing → Prepared → Committing → Committed → Defaulted
  // ──────────────────────────────────────────────────────────────────

  describe("state machine", () => {
    it("happy path: Created → Committed", async () => {
      const loanId = await createLoan();

      // startPrepare
      const prepTx = await hub.startPrepare(loanId);
      const prepReceipt = await prepTx.wait();
      const prepQids = extractQueryIds(prepReceipt!, "XcmPrepareSent");
      expect(prepQids.length).to.equal(1);

      await hub.connect(xcmExecutor).onXcmAck(prepQids[0]!, true);
      expect((await hub.getLoan(loanId)).state).to.equal(2n); // Prepared

      // startCommit
      const commitTx = await hub.startCommit(loanId);
      const commitReceipt = await commitTx.wait();
      const commitQids = extractQueryIds(commitReceipt!, "XcmCommitSent");

      await hub.connect(xcmExecutor).onXcmAck(commitQids[0]!, true);
      expect((await hub.getLoan(loanId)).state).to.equal(4n); // Committed
    });

    it("prepare failure → Aborted, bond returned", async () => {
      const loanId = await createLoan();
      const bondAmount = (await hub.getBondInfo(loanId)).bondAmount;
      const bBefore = await token.balanceOf(borrower.address);

      const prepTx = await hub.startPrepare(loanId);
      const prepReceipt = await prepTx.wait();
      const prepQids = extractQueryIds(prepReceipt!, "XcmPrepareSent");

      await hub.connect(xcmExecutor).onXcmAck(prepQids[0]!, false);

      expect((await hub.getLoan(loanId)).state).to.equal(8n); // Aborted
      const bAfter = await token.balanceOf(borrower.address);
      expect(bAfter - bBefore).to.equal(bondAmount);
    });

    it("committed → trigger default after expiry", async () => {
      const loanId = await createLoan();
      const loan = await hub.getLoan(loanId);

      const prepTx = await hub.startPrepare(loanId);
      const prepQids = extractQueryIds(await prepTx.wait()!, "XcmPrepareSent");
      await hub.connect(xcmExecutor).onXcmAck(prepQids[0]!, true);

      const commitTx = await hub.startCommit(loanId);
      const commitQids = extractQueryIds(await commitTx.wait()!, "XcmCommitSent");
      await hub.connect(xcmExecutor).onXcmAck(commitQids[0]!, true);

      await time.increaseTo(Number(loan.expiryAt) + 1);
      await hub.triggerDefault(loanId);

      expect((await hub.getLoan(loanId)).state).to.equal(9n); // Defaulted
    });

    it("commit paused → startCommit reverts", async () => {
      const loanId = await createLoan();
      const prepTx = await hub.startPrepare(loanId);
      const prepQids = extractQueryIds(await prepTx.wait()!, "XcmPrepareSent");
      await hub.connect(xcmExecutor).onXcmAck(prepQids[0]!, true);

      await hub.pauseCommit(true);
      await expect(hub.startCommit(loanId)).to.be.revertedWith("COMMIT_PAUSED");
    });
  });

  // ──────────────────────────────────────────────────────────────────
  // cancelBeforeCommit
  // ──────────────────────────────────────────────────────────────────

  describe("cancelBeforeCommit", () => {
    it("cancels in Created state and returns bond", async () => {
      const loanId = await createLoan();
      const bondAmount = (await hub.getBondInfo(loanId)).bondAmount;
      const bBefore = await token.balanceOf(borrower.address);

      await hub.connect(borrower).cancelBeforeCommit(loanId);
      expect((await hub.getLoan(loanId)).state).to.equal(8n); // Aborted
      expect((await token.balanceOf(borrower.address)) - bBefore).to.equal(bondAmount);
    });

    it("stranger cannot cancel", async () => {
      const loanId = await createLoan();
      await expect(hub.connect(stranger).cancelBeforeCommit(loanId))
        .to.be.revertedWith("NOT_BORROWER");
    });
  });

  // ──────────────────────────────────────────────────────────────────
  // triggerDefault payout math
  // ──────────────────────────────────────────────────────────────────

  describe("triggerDefault payout", () => {
    it("pays vault correctly and returns remainder", async () => {
      const loanId = await createLoan();
      const bondAmount = (await hub.getBondInfo(loanId)).bondAmount;
      const bBefore = await token.balanceOf(borrower.address);

      const prepTx = await hub.startPrepare(loanId);
      const prepQids = extractQueryIds(await prepTx.wait()!, "XcmPrepareSent");
      await hub.connect(xcmExecutor).onXcmAck(prepQids[0]!, true);

      const commitTx = await hub.startCommit(loanId);
      const commitQids = extractQueryIds(await commitTx.wait()!, "XcmCommitSent");
      await hub.connect(xcmExecutor).onXcmAck(commitQids[0]!, true);

      const loan = await hub.getLoan(loanId);
      await time.increaseTo(Number(loan.expiryAt) + 1);
      await hub.triggerDefault(loanId);

      const repayAmt = (PRINCIPAL * (10000n + INTEREST_BPS) + 9999n) / 10000n;
      expect(await token.balanceOf(VAULT_A)).to.equal(repayAmt);

      const remainder = bondAmount - repayAmt;
      expect((await token.balanceOf(borrower.address)) - bBefore).to.equal(remainder);
    });
  });
});
