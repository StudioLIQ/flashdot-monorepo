// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {FlashDotVault} from "../../contracts/FlashDotVault.sol";
import {IFlashDotVault} from "../../contracts/interfaces/IFlashDotVault.sol";
import {ERC20Mock} from "./helpers/ERC20Mock.sol";

/// @title VaultRepayTest
/// @notice Unit tests for FlashDotVault repay and claimDefault
contract VaultRepayTest is Test {
    FlashDotVault public vault;
    ERC20Mock public token;

    address public constant HUB      = address(0xBEEF);
    address public constant LP1      = address(0xA1);
    address public constant BORROWER = address(0xB1);

    uint256 public constant POOL_SIZE = 1_000_000 ether;
    uint256 public constant PRINCIPAL = 100_000 ether;
    uint256 public constant REPAY_AMT = 101_000 ether; // 1% interest
    uint64  public constant EXPIRY_OFFSET = 1 hours;

    function setUp() public {
        token = new ERC20Mock("Mock DOT", "DOT", 18);
        vault = new FlashDotVault(address(token), HUB);

        token.mint(LP1, POOL_SIZE);
        vm.prank(LP1);
        token.approve(address(vault), type(uint256).max);
        vm.prank(LP1);
        vault.deposit(POOL_SIZE);

        // Pre-fund borrower for repay
        token.mint(BORROWER, REPAY_AMT * 10);
        vm.prank(BORROWER);
        token.approve(address(vault), type(uint256).max);
    }

    function _prepare(uint256 loanId) internal returns (uint64 expiryAt) {
        expiryAt = uint64(block.timestamp + EXPIRY_OFFSET);
        vm.prank(HUB);
        vault.prepare(loanId, PRINCIPAL, REPAY_AMT, expiryAt, BORROWER, bytes32(0));
    }

    function _commit(uint256 loanId) internal {
        vm.prank(HUB);
        vault.commit(loanId);
    }

    function _assertInvariant() internal view {
        IFlashDotVault.PoolState memory p = vault.getPool();
        assertEq(p.total, p.available + p.reserved + p.borrowed, "POOL_INVARIANT");
    }

    // ─────────────────────────────────────────────────────────────────
    // Repay
    // ─────────────────────────────────────────────────────────────────

    function test_repay_happyPath() public {
        _prepare(1);
        _commit(1);

        vm.prank(BORROWER);
        vault.repay(1, REPAY_AMT);

        IFlashDotVault.PoolState memory p = vault.getPool();
        assertEq(p.borrowed, 0, "borrowed cleared");
        // available should be POOL_SIZE - PRINCIPAL + REPAY_AMT (interest added)
        assertEq(p.available, POOL_SIZE - PRINCIPAL + REPAY_AMT, "available includes interest");
        // total grows by interest
        assertEq(p.total, POOL_SIZE + (REPAY_AMT - PRINCIPAL), "total includes interest income");

        IFlashDotVault.VaultLoan memory vl = vault.getVaultLoan(1);
        assertEq(uint8(vl.state), uint8(IFlashDotVault.VaultLoanState.Repaid));
        _assertInvariant();
    }

    function test_repay_interestAccounting() public {
        _prepare(1);
        _commit(1);

        uint256 totalBefore = vault.getPool().total;
        vm.prank(BORROWER);
        vault.repay(1, REPAY_AMT);

        uint256 totalAfter = vault.getPool().total;
        uint256 interest = REPAY_AMT - PRINCIPAL;
        assertEq(totalAfter - totalBefore, interest, "interest reflected in pool.total");
    }

    function test_repay_notCommitted_reverts() public {
        _prepare(1);
        // Not committed — should revert
        vm.prank(BORROWER);
        vm.expectRevert(FlashDotVault.NotCommitted.selector);
        vault.repay(1, REPAY_AMT);
    }

    function test_repay_alreadyRepaid_reverts() public {
        _prepare(1);
        _commit(1);

        vm.prank(BORROWER);
        vault.repay(1, REPAY_AMT);

        // Second repay — state is Repaid, not Committed
        vm.prank(BORROWER);
        vm.expectRevert(FlashDotVault.NotCommitted.selector);
        vault.repay(1, REPAY_AMT);
    }

    function test_repay_zeroAmount_reverts() public {
        _prepare(1);
        _commit(1);

        vm.prank(BORROWER);
        vm.expectRevert(FlashDotVault.InvalidRepayAmount.selector);
        vault.repay(1, 0);
    }

    function test_repay_excessAmount_reverts() public {
        _prepare(1);
        _commit(1);

        vm.prank(BORROWER);
        vm.expectRevert(FlashDotVault.InvalidRepayAmount.selector);
        vault.repay(1, REPAY_AMT + 1);
    }

    // ─────────────────────────────────────────────────────────────────
    // ClaimDefault
    // ─────────────────────────────────────────────────────────────────

    function test_claimDefault_afterExpiry_success() public {
        uint64 expiryAt = _prepare(1);
        _commit(1);

        // Warp past expiry
        vm.warp(expiryAt + 1);

        vault.claimDefault(1); // permissionless

        IFlashDotVault.VaultLoan memory vl = vault.getVaultLoan(1);
        assertEq(uint8(vl.state), uint8(IFlashDotVault.VaultLoanState.DefaultClaimed));

        // Pool accounting: borrowed cleared, available includes repayAmount
        IFlashDotVault.PoolState memory p = vault.getPool();
        assertEq(p.borrowed, 0);
        assertEq(p.available, POOL_SIZE - PRINCIPAL + REPAY_AMT);
        _assertInvariant();
    }

    function test_claimDefault_beforeExpiry_reverts() public {
        _prepare(1);
        _commit(1);

        vm.expectRevert(FlashDotVault.NotExpired.selector);
        vault.claimDefault(1);
    }

    function test_claimDefault_notCommitted_reverts() public {
        uint64 expiryAt = _prepare(1);
        // Not committed — abort instead
        vm.prank(HUB);
        vault.abort(1);

        vm.warp(expiryAt + 1);
        vm.expectRevert(FlashDotVault.NotCommitted.selector);
        vault.claimDefault(1);
    }

    function test_claimDefault_afterRepay_reverts() public {
        uint64 expiryAt = _prepare(1);
        _commit(1);

        vm.prank(BORROWER);
        vault.repay(1, REPAY_AMT);

        vm.warp(expiryAt + 1);
        vm.expectRevert(FlashDotVault.NotCommitted.selector);
        vault.claimDefault(1);
    }

    // ─────────────────────────────────────────────────────────────────
    // Fuzz
    // ─────────────────────────────────────────────────────────────────

    function testFuzz_repay_invariant(uint96 principal, uint16 interestBps) public {
        vm.assume(principal > 0 && principal <= POOL_SIZE / 2);
        vm.assume(interestBps > 0 && interestBps <= 1000); // max 10%

        // repayAmount = ceil(principal * (10000 + bps) / 10000)
        uint256 repayAmt = (uint256(principal) * (10_000 + interestBps) + 9_999) / 10_000;

        vm.prank(HUB);
        vault.prepare(99, principal, repayAmt, uint64(block.timestamp + 1 hours), BORROWER, bytes32(0));
        vm.prank(HUB);
        vault.commit(99);
        _assertInvariant();

        token.mint(BORROWER, repayAmt);
        vm.prank(BORROWER);
        token.approve(address(vault), repayAmt);

        vm.prank(BORROWER);
        vault.repay(99, repayAmt);
        _assertInvariant();
    }
}
