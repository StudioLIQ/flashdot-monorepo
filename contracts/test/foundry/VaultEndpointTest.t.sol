// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {FlashDotVault} from "../../contracts/FlashDotVault.sol";
import {IFlashDotVault} from "../../contracts/interfaces/IFlashDotVault.sol";
import {ERC20Mock} from "./helpers/ERC20Mock.sol";

/// @title VaultEndpointTest
/// @notice Unit tests for FlashDotVault prepare / commit / abort endpoints
contract VaultEndpointTest is Test {
    FlashDotVault public vault;
    ERC20Mock public token;

    address public constant HUB     = address(0xBEEF);
    address public constant LP1     = address(0xA1);
    address public constant BORROWER = address(0xB1);
    address public constant STRANGER = address(0xDEAD);

    uint256 public constant POOL_SIZE = 1_000_000 ether;
    uint256 public constant PRINCIPAL = 100_000 ether;
    uint256 public constant REPAY_AMT = 101_000 ether; // 1% interest
    uint64  public constant EXPIRY    = 1 hours;        // relative to block.timestamp

    function setUp() public {
        token = new ERC20Mock("Mock DOT", "DOT", 18);
        vault = new FlashDotVault(address(token), HUB);

        token.mint(LP1, POOL_SIZE);
        vm.prank(LP1);
        token.approve(address(vault), type(uint256).max);
        vm.prank(LP1);
        vault.deposit(POOL_SIZE);
    }

    function _expiryAt() internal view returns (uint64) {
        return uint64(block.timestamp + EXPIRY);
    }

    // ─────────────────────────────────────────────────────────────────
    // Prepare
    // ─────────────────────────────────────────────────────────────────

    function test_prepare_happyPath() public {
        vm.prank(HUB);
        vault.prepare(1, PRINCIPAL, REPAY_AMT, _expiryAt(), BORROWER, bytes32(0));

        IFlashDotVault.PoolState memory p = vault.getPool();
        assertEq(p.available, POOL_SIZE - PRINCIPAL);
        assertEq(p.reserved, PRINCIPAL);
        assertEq(p.borrowed, 0);
        assertEq(p.total, POOL_SIZE);

        IFlashDotVault.VaultLoan memory vl = vault.getVaultLoan(1);
        assertEq(uint8(vl.state), uint8(IFlashDotVault.VaultLoanState.Prepared));
        assertEq(vl.principal, PRINCIPAL);
    }

    function test_prepare_sameParams_idempotent() public {
        vm.prank(HUB);
        vault.prepare(1, PRINCIPAL, REPAY_AMT, _expiryAt(), BORROWER, bytes32(0));

        uint64 exp = _expiryAt();
        // Second call with same params — no-op (no revert)
        vm.prank(HUB);
        vault.prepare(1, PRINCIPAL, REPAY_AMT, exp, BORROWER, bytes32(0));

        // Pool unchanged
        IFlashDotVault.PoolState memory p = vault.getPool();
        assertEq(p.reserved, PRINCIPAL);
    }

    function test_prepare_differentParams_reverts() public {
        uint64 exp = _expiryAt();
        vm.prank(HUB);
        vault.prepare(1, PRINCIPAL, REPAY_AMT, exp, BORROWER, bytes32(0));

        vm.prank(HUB);
        vm.expectRevert(FlashDotVault.PrepareConflict.selector);
        vault.prepare(1, PRINCIPAL + 1, REPAY_AMT, exp, BORROWER, bytes32(0));
    }

    function test_prepare_insufficientLiquidity_reverts() public {
        vm.prank(HUB);
        vm.expectRevert(FlashDotVault.InsufficientLiquidity.selector);
        vault.prepare(1, POOL_SIZE + 1, POOL_SIZE + 2, _expiryAt(), BORROWER, bytes32(0));
    }

    function test_prepare_unauthorizedCaller_reverts() public {
        vm.prank(STRANGER);
        vm.expectRevert(FlashDotVault.NotHubOrigin.selector);
        vault.prepare(1, PRINCIPAL, REPAY_AMT, _expiryAt(), BORROWER, bytes32(0));
    }

    // ─────────────────────────────────────────────────────────────────
    // Commit
    // ─────────────────────────────────────────────────────────────────

    function test_commit_happyPath() public {
        vm.prank(HUB);
        vault.prepare(1, PRINCIPAL, REPAY_AMT, _expiryAt(), BORROWER, bytes32(0));

        uint256 borrowerBalBefore = token.balanceOf(BORROWER);
        vm.prank(HUB);
        vault.commit(1);

        IFlashDotVault.PoolState memory p = vault.getPool();
        assertEq(p.reserved, 0);
        assertEq(p.borrowed, PRINCIPAL);
        assertEq(p.available, POOL_SIZE - PRINCIPAL);

        assertEq(token.balanceOf(BORROWER) - borrowerBalBefore, PRINCIPAL, "funds sent to borrower");

        IFlashDotVault.VaultLoan memory vl = vault.getVaultLoan(1);
        assertEq(uint8(vl.state), uint8(IFlashDotVault.VaultLoanState.Committed));
    }

    function test_commit_doubleCommit_idempotent() public {
        vm.prank(HUB);
        vault.prepare(1, PRINCIPAL, REPAY_AMT, _expiryAt(), BORROWER, bytes32(0));
        vm.prank(HUB);
        vault.commit(1);
        // Second commit — no-op, no revert
        vm.prank(HUB);
        vault.commit(1);

        IFlashDotVault.VaultLoan memory vl = vault.getVaultLoan(1);
        assertEq(uint8(vl.state), uint8(IFlashDotVault.VaultLoanState.Committed));
    }

    function test_commit_afterAbort_reverts() public {
        vm.prank(HUB);
        vault.prepare(1, PRINCIPAL, REPAY_AMT, _expiryAt(), BORROWER, bytes32(0));
        vm.prank(HUB);
        vault.abort(1);
        vm.prank(HUB);
        vm.expectRevert(FlashDotVault.NotPrepared.selector);
        vault.commit(1);
    }

    function test_commit_unauthorizedCaller_reverts() public {
        vm.prank(HUB);
        vault.prepare(1, PRINCIPAL, REPAY_AMT, _expiryAt(), BORROWER, bytes32(0));

        vm.prank(STRANGER);
        vm.expectRevert(FlashDotVault.NotHubOrigin.selector);
        vault.commit(1);
    }

    // ─────────────────────────────────────────────────────────────────
    // Abort
    // ─────────────────────────────────────────────────────────────────

    function test_abort_happyPath() public {
        vm.prank(HUB);
        vault.prepare(1, PRINCIPAL, REPAY_AMT, _expiryAt(), BORROWER, bytes32(0));

        vm.prank(HUB);
        vault.abort(1);

        IFlashDotVault.PoolState memory p = vault.getPool();
        assertEq(p.reserved, 0);
        assertEq(p.available, POOL_SIZE);

        IFlashDotVault.VaultLoan memory vl = vault.getVaultLoan(1);
        assertEq(uint8(vl.state), uint8(IFlashDotVault.VaultLoanState.Aborted));
    }

    function test_abort_afterCommit_reverts() public {
        vm.prank(HUB);
        vault.prepare(1, PRINCIPAL, REPAY_AMT, _expiryAt(), BORROWER, bytes32(0));
        vm.prank(HUB);
        vault.commit(1);

        vm.prank(HUB);
        vm.expectRevert(FlashDotVault.CommitIsFinal.selector);
        vault.abort(1);
    }

    function test_abort_doubleAbort_idempotent() public {
        vm.prank(HUB);
        vault.prepare(1, PRINCIPAL, REPAY_AMT, _expiryAt(), BORROWER, bytes32(0));
        vm.prank(HUB);
        vault.abort(1);
        // Second abort — no-op
        vm.prank(HUB);
        vault.abort(1);

        IFlashDotVault.VaultLoan memory vl = vault.getVaultLoan(1);
        assertEq(uint8(vl.state), uint8(IFlashDotVault.VaultLoanState.Aborted));
    }

    function test_abort_unauthorizedCaller_reverts() public {
        vm.prank(HUB);
        vault.prepare(1, PRINCIPAL, REPAY_AMT, _expiryAt(), BORROWER, bytes32(0));

        vm.prank(STRANGER);
        vm.expectRevert(FlashDotVault.NotHubOrigin.selector);
        vault.abort(1);
    }

    // ─────────────────────────────────────────────────────────────────
    // Pool invariant after endpoint ops
    // ─────────────────────────────────────────────────────────────────

    function _assertInvariant() internal view {
        IFlashDotVault.PoolState memory p = vault.getPool();
        assertEq(p.total, p.available + p.reserved + p.borrowed, "POOL_INVARIANT");
    }

    function testFuzz_prepare_commit_abort_invariant(
        uint96 principal,
        uint8  action   // 0=abort, 1=commit
    ) public {
        vm.assume(principal > 0 && principal <= POOL_SIZE);
        uint256 repay = principal + (principal / 100); // ~1%

        vm.prank(HUB);
        vault.prepare(42, principal, repay, _expiryAt(), BORROWER, bytes32(0));
        _assertInvariant();

        if (action % 2 == 0) {
            vm.prank(HUB);
            vault.abort(42);
        } else {
            vm.prank(HUB);
            vault.commit(42);
        }
        _assertInvariant();
    }
}
