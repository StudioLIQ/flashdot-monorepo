// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {FlashDotVault} from "../../contracts/FlashDotVault.sol";
import {IFlashDotVault} from "../../contracts/interfaces/IFlashDotVault.sol";
import {ERC20Mock} from "./helpers/ERC20Mock.sol";

/// @title VaultTest
/// @notice Comprehensive fuzz test covering pool invariant across all operations.
///         Combines all vault operations for cross-function invariant testing.
contract VaultTest is Test {
    FlashDotVault public vault;
    ERC20Mock public token;

    address public constant HUB      = address(0xBEEF);
    address public constant LP1      = address(0xA1);
    address public constant LP2      = address(0xA2);
    address public constant BORROWER = address(0xB1);

    uint256 public constant MAX_AMOUNT = 1_000_000 ether;

    function setUp() public {
        token = new ERC20Mock("Mock DOT", "DOT", 18);
        vault = new FlashDotVault(address(token), HUB);

        token.mint(LP1, MAX_AMOUNT * 2);
        token.mint(LP2, MAX_AMOUNT * 2);
        token.mint(BORROWER, MAX_AMOUNT * 2);

        vm.prank(LP1);
        token.approve(address(vault), type(uint256).max);
        vm.prank(LP2);
        token.approve(address(vault), type(uint256).max);
        vm.prank(BORROWER);
        token.approve(address(vault), type(uint256).max);
    }

    function _assertInvariant() internal view {
        IFlashDotVault.PoolState memory p = vault.getPool();
        assertEq(p.total, p.available + p.reserved + p.borrowed, "POOL_INVARIANT violated");
    }

    /// @notice Fuzz the full lifecycle: deposit → prepare → commit → repay
    function testFuzz_fullLifecycle_invariant(
        uint96 depositAmt,
        uint96 principal,
        uint16 interestBps
    ) public {
        vm.assume(depositAmt > 0 && depositAmt <= MAX_AMOUNT);
        vm.assume(principal > 0 && principal <= depositAmt);
        vm.assume(interestBps > 0 && interestBps <= 1000);

        // Deposit
        vm.prank(LP1);
        vault.deposit(depositAmt);
        _assertInvariant();

        // Prepare
        uint256 repayAmt = (uint256(principal) * (10_000 + interestBps) + 9_999) / 10_000;
        uint64  expiryAt = uint64(block.timestamp + 1 hours);

        vm.prank(HUB);
        vault.prepare(1, principal, repayAmt, expiryAt, BORROWER, bytes32(0));
        _assertInvariant();

        // Commit
        vm.prank(HUB);
        vault.commit(1);
        _assertInvariant();

        // Repay
        token.mint(BORROWER, repayAmt);
        vm.prank(BORROWER);
        vault.repay(1, repayAmt);
        _assertInvariant();

        // Final checks
        IFlashDotVault.PoolState memory p = vault.getPool();
        assertEq(p.borrowed, 0);
        assertEq(p.reserved, 0);
        assertGe(p.available, depositAmt, "pool available should be >= initial deposit after repay");
    }

    /// @notice Fuzz the abort path: deposit → prepare → abort
    function testFuzz_abortPath_invariant(uint96 depositAmt, uint96 principal) public {
        vm.assume(depositAmt > 0 && depositAmt <= MAX_AMOUNT);
        vm.assume(principal > 0 && principal <= depositAmt);

        vm.prank(LP1);
        vault.deposit(depositAmt);

        vm.prank(HUB);
        vault.prepare(1, principal, principal + 1000, uint64(block.timestamp + 1 hours), BORROWER, bytes32(0));
        _assertInvariant();

        vm.prank(HUB);
        vault.abort(1);
        _assertInvariant();

        // After abort, available should be fully restored
        IFlashDotVault.PoolState memory p = vault.getPool();
        assertEq(p.available, depositAmt, "full deposit restored after abort");
        assertEq(p.reserved, 0);
    }

    /// @notice Fuzz the default path: deposit → prepare → commit → claimDefault
    function testFuzz_defaultPath_invariant(uint96 depositAmt, uint96 principal) public {
        vm.assume(depositAmt > 0 && depositAmt <= MAX_AMOUNT);
        vm.assume(principal > 0 && principal <= depositAmt);

        uint256 repayAmt = uint256(principal) + 1000;

        vm.prank(LP1);
        vault.deposit(depositAmt);

        uint64 expiryAt = uint64(block.timestamp + 1 hours);
        vm.prank(HUB);
        vault.prepare(1, principal, repayAmt, expiryAt, BORROWER, bytes32(0));
        vm.prank(HUB);
        vault.commit(1);
        _assertInvariant();

        // Pass expiry
        vm.warp(expiryAt + 1);
        vault.claimDefault(1);
        _assertInvariant();

        IFlashDotVault.PoolState memory p = vault.getPool();
        assertEq(p.borrowed, 0);
        assertEq(p.reserved, 0);
    }

    /// @notice Two LPs deposit and withdraw without interference
    function testFuzz_multiLP_invariant(uint96 amt1, uint96 amt2) public {
        vm.assume(amt1 > 0 && amt1 <= MAX_AMOUNT);
        vm.assume(amt2 > 0 && amt2 <= MAX_AMOUNT);

        vm.prank(LP1);
        vault.deposit(amt1);
        _assertInvariant();

        vm.prank(LP2);
        vault.deposit(amt2);
        _assertInvariant();

        uint256 shares1 = vault.sharesOf(LP1);
        vm.prank(LP1);
        vault.withdraw(shares1);
        _assertInvariant();

        uint256 shares2 = vault.sharesOf(LP2);
        vm.prank(LP2);
        vault.withdraw(shares2);
        _assertInvariant();

        IFlashDotVault.PoolState memory p = vault.getPool();
        assertEq(p.total, 0);
        assertEq(p.available, 0);
    }
}
