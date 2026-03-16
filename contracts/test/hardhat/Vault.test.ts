import { expect } from "chai";
import { ethers } from "hardhat";
import { FlashDotVault, ERC20Mock } from "../../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-toolbox/network-helpers";

describe("FlashDotVault", () => {
  let vault: FlashDotVault;
  let token: ERC20Mock;
  let hub: SignerWithAddress;
  let lp1: SignerWithAddress;
  let lp2: SignerWithAddress;
  let borrower: SignerWithAddress;
  let stranger: SignerWithAddress;

  const POOL_SIZE = ethers.parseEther("1000000");
  const PRINCIPAL = ethers.parseEther("100000");
  const REPAY_AMT = ethers.parseEther("101000"); // 1% interest
  const EXPIRY_OFFSET = 3600; // 1 hour

  async function deployContracts() {
    [hub, lp1, lp2, borrower, stranger] = await ethers.getSigners();

    const ERC20MockFactory = await ethers.getContractFactory("ERC20Mock");
    token = (await ERC20MockFactory.deploy("Mock DOT", "DOT", 18)) as ERC20Mock;

    const VaultFactory = await ethers.getContractFactory("FlashDotVault");
    vault = (await VaultFactory.deploy(await token.getAddress(), hub.address)) as FlashDotVault;

    await token.mint(lp1.address, POOL_SIZE * 2n);
    await token.mint(lp2.address, POOL_SIZE * 2n);
    await token.mint(borrower.address, REPAY_AMT * 10n);

    await token.connect(lp1).approve(await vault.getAddress(), ethers.MaxUint256);
    await token.connect(lp2).approve(await vault.getAddress(), ethers.MaxUint256);
    await token.connect(borrower).approve(await vault.getAddress(), ethers.MaxUint256);
  }

  async function expiryAt() {
    return (await time.latest()) + EXPIRY_OFFSET;
  }

  async function depositPool() {
    await token.connect(lp1).approve(await vault.getAddress(), ethers.MaxUint256);
    await vault.connect(lp1).deposit(POOL_SIZE);
  }

  async function prepare(loanId = 1n) {
    const exp = await expiryAt();
    await vault.connect(hub).prepare(loanId, PRINCIPAL, REPAY_AMT, exp, borrower.address, ethers.ZeroHash);
    return exp;
  }

  async function assertPoolInvariant() {
    const pool = await vault.getPool();
    expect(pool.total).to.equal(pool.available + pool.reserved + pool.borrowed, "POOL_INVARIANT");
  }

  beforeEach(async () => {
    await deployContracts();
  });

  // ──────────────────────────────────────────────────────────────────
  // Deposit
  // ──────────────────────────────────────────────────────────────────

  describe("deposit", () => {
    it("first LP gets 1:1 shares", async () => {
      const amount = ethers.parseEther("1000");
      await expect(vault.connect(lp1).deposit(amount))
        .to.emit(vault, "Deposited")
        .withArgs(lp1.address, amount, amount);

      const shares = await vault.sharesOf(lp1.address);
      expect(shares).to.equal(amount);

      const pool = await vault.getPool();
      expect(pool.available).to.equal(amount);
      expect(pool.total).to.equal(amount);
    });

    it("second LP gets pro-rata shares (no interest)", async () => {
      const amount = ethers.parseEther("1000");
      await vault.connect(lp1).deposit(amount);
      await vault.connect(lp2).deposit(amount);

      const shares1 = await vault.sharesOf(lp1.address);
      const shares2 = await vault.sharesOf(lp2.address);
      expect(shares1).to.equal(shares2, "equal deposits get equal shares");
    });

    it("reverts on zero amount", async () => {
      await expect(vault.connect(lp1).deposit(0n)).to.be.revertedWithCustomError(vault, "ZeroAmount");
    });

    it("maintains pool invariant", async () => {
      await vault.connect(lp1).deposit(POOL_SIZE);
      await assertPoolInvariant();
    });
  });

  // ──────────────────────────────────────────────────────────────────
  // Withdraw
  // ──────────────────────────────────────────────────────────────────

  describe("withdraw", () => {
    beforeEach(depositPool);

    it("withdraw all shares returns original amount", async () => {
      const shares = await vault.sharesOf(lp1.address);
      await expect(vault.connect(lp1).withdraw(shares))
        .to.emit(vault, "Withdrawn")
        .withArgs(lp1.address, shares, POOL_SIZE);

      const pool = await vault.getPool();
      expect(pool.available).to.equal(0n);
      expect(pool.total).to.equal(0n);
    });

    it("reverts on zero shares", async () => {
      await expect(vault.connect(lp1).withdraw(0n)).to.be.revertedWithCustomError(vault, "ZeroShares");
    });

    it("reverts when pool is locked (prepare consumed all available)", async () => {
      // Prepare with full pool size so available == 0
      const exp = await expiryAt();
      await vault.connect(hub).prepare(1n, POOL_SIZE, POOL_SIZE + PRINCIPAL, exp, borrower.address, ethers.ZeroHash);
      const shares = await vault.sharesOf(lp1.address);
      // available == 0, withdraw amount == 0 → ZERO_AMOUNT
      await expect(vault.connect(lp1).withdraw(shares)).to.be.revertedWithCustomError(vault, "ZeroAmount");
    });

    it("maintains pool invariant", async () => {
      const shares = await vault.sharesOf(lp1.address);
      await vault.connect(lp1).withdraw(shares / 2n);
      await assertPoolInvariant();
    });
  });

  // ──────────────────────────────────────────────────────────────────
  // Prepare
  // ──────────────────────────────────────────────────────────────────

  describe("prepare", () => {
    beforeEach(depositPool);

    it("happy path: available → reserved", async () => {
      await prepare();
      const pool = await vault.getPool();
      expect(pool.available).to.equal(POOL_SIZE - PRINCIPAL);
      expect(pool.reserved).to.equal(PRINCIPAL);
      await assertPoolInvariant();
    });

    it("same params idempotency: no revert", async () => {
      const exp = await expiryAt();
      await vault.connect(hub).prepare(1n, PRINCIPAL, REPAY_AMT, exp, borrower.address, ethers.ZeroHash);
      // Exact same call — should not revert
      await vault.connect(hub).prepare(1n, PRINCIPAL, REPAY_AMT, exp, borrower.address, ethers.ZeroHash);
    });

    it("different params conflict: revert", async () => {
      const exp = await expiryAt();
      await vault.connect(hub).prepare(1n, PRINCIPAL, REPAY_AMT, exp, borrower.address, ethers.ZeroHash);
      await expect(
        vault.connect(hub).prepare(1n, PRINCIPAL + 1n, REPAY_AMT, exp, borrower.address, ethers.ZeroHash)
      ).to.be.revertedWithCustomError(vault, "PrepareConflict");
    });

    it("insufficient liquidity: revert", async () => {
      await expect(
        vault.connect(hub).prepare(1n, POOL_SIZE + 1n, POOL_SIZE + 2n, await expiryAt(), borrower.address, ethers.ZeroHash)
      ).to.be.revertedWithCustomError(vault, "InsufficientLiquidity");
    });

    it("non-hub caller: revert", async () => {
      await expect(
        vault.connect(stranger).prepare(1n, PRINCIPAL, REPAY_AMT, await expiryAt(), borrower.address, ethers.ZeroHash)
      ).to.be.revertedWithCustomError(vault, "NotHubOrigin");
    });
  });

  // ──────────────────────────────────────────────────────────────────
  // Commit
  // ──────────────────────────────────────────────────────────────────

  describe("commit", () => {
    beforeEach(async () => {
      await depositPool();
      await prepare();
    });

    it("happy path: reserved → borrowed, token transfer", async () => {
      const borrowerBefore = await token.balanceOf(borrower.address);
      await expect(vault.connect(hub).commit(1n))
        .to.emit(vault, "LoanCommitted")
        .withArgs(1n, borrower.address, PRINCIPAL);

      const pool = await vault.getPool();
      expect(pool.reserved).to.equal(0n);
      expect(pool.borrowed).to.equal(PRINCIPAL);
      expect(await token.balanceOf(borrower.address)).to.equal(borrowerBefore + PRINCIPAL);
    });

    it("double commit: idempotent", async () => {
      await vault.connect(hub).commit(1n);
      await vault.connect(hub).commit(1n); // no revert
    });

    it("commit after abort: revert", async () => {
      await vault.connect(hub).abort(1n);
      await expect(vault.connect(hub).commit(1n)).to.be.revertedWithCustomError(vault, "NotPrepared");
    });

    it("non-hub caller: revert", async () => {
      await expect(vault.connect(stranger).commit(1n)).to.be.revertedWithCustomError(vault, "NotHubOrigin");
    });
  });

  // ──────────────────────────────────────────────────────────────────
  // Abort
  // ──────────────────────────────────────────────────────────────────

  describe("abort", () => {
    beforeEach(async () => {
      await depositPool();
      await prepare();
    });

    it("happy path: reserved → available", async () => {
      await expect(vault.connect(hub).abort(1n)).to.emit(vault, "LoanAborted").withArgs(1n);
      const pool = await vault.getPool();
      expect(pool.reserved).to.equal(0n);
      expect(pool.available).to.equal(POOL_SIZE);
    });

    it("abort after commit: revert COMMIT_IS_FINAL", async () => {
      await vault.connect(hub).commit(1n);
      await expect(vault.connect(hub).abort(1n)).to.be.revertedWithCustomError(vault, "CommitIsFinal");
    });

    it("double abort: idempotent", async () => {
      await vault.connect(hub).abort(1n);
      await vault.connect(hub).abort(1n); // no revert
    });

    it("non-hub caller: revert", async () => {
      await expect(vault.connect(stranger).abort(1n)).to.be.revertedWithCustomError(vault, "NotHubOrigin");
    });
  });

  // ──────────────────────────────────────────────────────────────────
  // Repay
  // ──────────────────────────────────────────────────────────────────

  describe("repay", () => {
    beforeEach(async () => {
      await depositPool();
      await prepare();
      await vault.connect(hub).commit(1n);
    });

    it("happy path: borrowed → available with interest", async () => {
      await expect(vault.connect(borrower).repay(1n, REPAY_AMT))
        .to.emit(vault, "LoanRepaid")
        .withArgs(1n, REPAY_AMT);

      const pool = await vault.getPool();
      expect(pool.borrowed).to.equal(0n);
      expect(pool.available).to.equal(POOL_SIZE - PRINCIPAL + REPAY_AMT);
      await assertPoolInvariant();
    });

    it("repay on non-committed: revert", async () => {
      await depositPool();
      // Fresh loan that's not committed
      const exp = await expiryAt();
      await vault.connect(hub).prepare(2n, PRINCIPAL, REPAY_AMT, exp, borrower.address, ethers.ZeroHash);
      await expect(vault.connect(borrower).repay(2n, REPAY_AMT)).to.be.revertedWithCustomError(vault, "NotCommitted");
    });

    it("repay after repaid: revert", async () => {
      await vault.connect(borrower).repay(1n, REPAY_AMT);
      await expect(vault.connect(borrower).repay(1n, REPAY_AMT)).to.be.revertedWithCustomError(vault, "NotCommitted");
    });
  });

  // ──────────────────────────────────────────────────────────────────
  // ClaimDefault
  // ──────────────────────────────────────────────────────────────────

  describe("claimDefault", () => {
    it("after expiry on committed: success", async () => {
      await depositPool();
      const exp = await prepare();
      await vault.connect(hub).commit(1n);

      await time.increaseTo(exp + 1);
      await expect(vault.connect(stranger).claimDefault(1n))
        .to.emit(vault, "DefaultClaimed")
        .withArgs(1n, REPAY_AMT);
    });

    it("before expiry: revert", async () => {
      await depositPool();
      await prepare();
      await vault.connect(hub).commit(1n);
      await expect(vault.claimDefault(1n)).to.be.revertedWithCustomError(vault, "NotExpired");
    });

    it("after expiry on repaid: revert", async () => {
      await depositPool();
      const exp = await prepare();
      await vault.connect(hub).commit(1n);
      await vault.connect(borrower).repay(1n, REPAY_AMT);

      await time.increaseTo(exp + 1);
      await expect(vault.claimDefault(1n)).to.be.revertedWithCustomError(vault, "NotCommitted");
    });
  });
});
