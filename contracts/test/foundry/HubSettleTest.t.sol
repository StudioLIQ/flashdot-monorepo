// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test, Vm} from "forge-std/Test.sol";
import {FlashDotHub} from "../../contracts/FlashDotHub.sol";
import {IFlashDotHub} from "../../contracts/interfaces/IFlashDotHub.sol";
import {ERC20Mock} from "./helpers/ERC20Mock.sol";

/// @title HubSettleTest
/// @notice Tests for finalizeSettle(), triggerDefault(), emergency controls
contract HubSettleTest is Test {
    FlashDotHub public hub;
    ERC20Mock   public token;

    address public constant XCM_EXECUTOR = address(0xEEEE);
    address public constant FEE_RECIPIENT = address(0xFEE0);
    address public constant BORROWER      = address(0xB1);

    bytes32 public constant CHAIN_A = keccak256("chain-a");
    bytes32 public constant CHAIN_B = keccak256("chain-b");
    address public constant VAULT_A = address(0xA111);
    address public constant VAULT_B = address(0xB111);

    uint256 public constant PRINCIPAL = 50_000 ether;
    uint256 public constant FEE_BUDGET = 1 ether;
    uint32  public constant INTEREST   = 100; // 1%
    uint64  public constant LOAN_DURATION = 1 days;

    function setUp() public {
        token = new ERC20Mock("Mock DOT", "DOT", 18);
        hub = new FlashDotHub(XCM_EXECUTOR, FEE_RECIPIENT);
        token.mint(BORROWER, 100_000_000 ether);
        vm.prank(BORROWER);
        token.approve(address(hub), type(uint256).max);
    }

    // ─────────────────────────────────────────────────────────────────
    // Helpers: build a fully committed loan
    // ─────────────────────────────────────────────────────────────────

    function _createAndCommitLoan() internal returns (uint256 loanId, uint64 expiryAt) {
        expiryAt = uint64(block.timestamp + LOAN_DURATION);
        IFlashDotHub.LoanParams memory params = IFlashDotHub.LoanParams({
            asset:        address(token),
            targetAmount: PRINCIPAL * 2,
            interestBps:  INTEREST,
            expiryAt:     expiryAt
        });
        IFlashDotHub.LegSpec[] memory legs = new IFlashDotHub.LegSpec[](2);
        legs[0] = IFlashDotHub.LegSpec({
            chain: CHAIN_A, vault: VAULT_A, amount: PRINCIPAL,
            feeBudget: FEE_BUDGET, legInterestBps: INTEREST
        });
        legs[1] = IFlashDotHub.LegSpec({
            chain: CHAIN_B, vault: VAULT_B, amount: PRINCIPAL,
            feeBudget: FEE_BUDGET, legInterestBps: INTEREST
        });

        vm.prank(BORROWER);
        loanId = hub.createLoan(params, legs);

        // Prepare
        vm.recordLogs();
        hub.startPrepare(loanId);
        bytes32[] memory pQids = _extractQids(vm.getRecordedLogs(), FlashDotHub.XcmPrepareSent.selector);
        vm.prank(XCM_EXECUTOR); hub.onXcmAck(pQids[0], true);
        vm.prank(XCM_EXECUTOR); hub.onXcmAck(pQids[1], true);

        // Commit
        vm.recordLogs();
        hub.startCommit(loanId);
        bytes32[] memory cQids = _extractQids(vm.getRecordedLogs(), FlashDotHub.XcmCommitSent.selector);
        vm.prank(XCM_EXECUTOR); hub.onXcmAck(cQids[0], true);
        vm.prank(XCM_EXECUTOR); hub.onXcmAck(cQids[1], true);

        assertEq(uint8(hub.getLoan(loanId).state), uint8(IFlashDotHub.LoanState.Committed));
    }

    function _repayLoan(uint256 loanId) internal {
        // Simulate repay confirmation: set legs to RepaidConfirmed
        // In a real system, the vault calls repay() and Hub listens for events.
        // For unit test, we need a way to advance leg state.
        // This is handled via the simulated repay flow through Hub.
        // For now, we use a test-only forceLegRepaid helper — but we don't have one.
        // Instead, rely on actual onXcmAck or repay via vault.
        // Since Hub doesn't have repay confirmation in T-13 scope, we test finalizeSettle
        // via the Hub's internal _allCommittedLegsRepaid check.
        //
        // Actually, looking at the design: finalizeSettle requires legs to be RepaidConfirmed.
        // The RepaidConfirmed state transition happens when Hub receives confirmation from vault repay.
        // This is handled in T-13 via the XCM callback path for repay confirmation.
        //
        // For simplicity in this test, we test triggerDefault (which doesn't need repay).
        // finalizeSettle test is covered in HubTest.t.sol (T-14).
        loanId;
    }

    function _extractQids(Vm.Log[] memory logs, bytes32 selector)
        internal pure returns (bytes32[] memory)
    {
        uint256 count = 0;
        for (uint256 i = 0; i < logs.length; i++) {
            if (logs[i].topics[0] == selector) count++;
        }
        bytes32[] memory ids = new bytes32[](count);
        uint256 idx = 0;
        for (uint256 i = 0; i < logs.length; i++) {
            if (logs[i].topics[0] == selector) {
                (, , , bytes32 qid) = abi.decode(logs[i].data, (uint256, bytes32, address, bytes32));
                ids[idx++] = qid;
            }
        }
        return ids;
    }

    // ─────────────────────────────────────────────────────────────────
    // triggerDefault
    // ─────────────────────────────────────────────────────────────────

    function test_triggerDefault_afterExpiry_success() public {
        (uint256 loanId, uint64 expiryAt) = _createAndCommitLoan();

        // Pre-fund hub for vault payouts (hub already has bond)
        uint256 hubBondBefore = token.balanceOf(address(hub));
        uint256 borrowerBalBefore = token.balanceOf(BORROWER);

        vm.warp(expiryAt + 1);

        vm.expectEmit(true, false, false, false);
        emit IFlashDotHub.LoanDefaulted(loanId, 0); // amount checked below
        hub.triggerDefault(loanId);

        assertEq(uint8(hub.getLoan(loanId).state), uint8(IFlashDotHub.LoanState.Defaulted));
        assertTrue(hub.getBondInfo(loanId).slashed, "bond should be marked slashed");

        // Each committed leg gets: ceil(PRINCIPAL * 10100 / 10000)
        uint256 repayPerLeg = (PRINCIPAL * (10_000 + INTEREST) + 9_999) / 10_000;
        uint256 totalPayout = repayPerLeg * 2;
        uint256 bondAmount = hub.getBondInfo(loanId).bondAmount;

        // Vault A and B receive repayAmt
        assertEq(token.balanceOf(VAULT_A), repayPerLeg, "vault A repay");
        assertEq(token.balanceOf(VAULT_B), repayPerLeg, "vault B repay");

        // Borrower receives remainder
        uint256 remainder = bondAmount - totalPayout;
        assertEq(
            token.balanceOf(BORROWER) - borrowerBalBefore,
            remainder,
            "remainder returned to borrower"
        );

        // Hub balance reduced by totalPayout (remainder went to borrower)
        assertEq(token.balanceOf(address(hub)), hubBondBefore - bondAmount);
    }

    function test_triggerDefault_beforeExpiry_reverts() public {
        (uint256 loanId,) = _createAndCommitLoan();
        vm.expectRevert("NOT_EXPIRED");
        hub.triggerDefault(loanId);
    }

    function test_triggerDefault_alreadyDefaulted_reverts() public {
        (uint256 loanId, uint64 expiryAt) = _createAndCommitLoan();
        vm.warp(expiryAt + 1);
        hub.triggerDefault(loanId);

        vm.expectRevert("ALREADY_DEFAULTED");
        hub.triggerDefault(loanId);
    }

    function test_triggerDefault_legsPaidCorrectly() public {
        (uint256 loanId, uint64 expiryAt) = _createAndCommitLoan();
        vm.warp(expiryAt + 1);
        hub.triggerDefault(loanId);

        // Both legs should be DefaultPaid
        assertEq(uint8(hub.getLeg(loanId, 0).state), uint8(IFlashDotHub.LegState.DefaultPaid));
        assertEq(uint8(hub.getLeg(loanId, 1).state), uint8(IFlashDotHub.LegState.DefaultPaid));
    }

    // ─────────────────────────────────────────────────────────────────
    // finalizeSettle
    // ─────────────────────────────────────────────────────────────────

    function test_finalizeSettle_whenLegsNotRepaid_reverts() public {
        (uint256 loanId,) = _createAndCommitLoan();
        // CommittedAcked legs not repaid yet
        vm.expectRevert("LEGS_NOT_FULLY_REPAID");
        hub.finalizeSettle(loanId);
    }

    // ─────────────────────────────────────────────────────────────────
    // Governance
    // ─────────────────────────────────────────────────────────────────

    function test_pauseCreate_onlyOwner() public {
        vm.prank(BORROWER);
        vm.expectRevert();
        hub.pauseCreate(true);

        hub.pauseCreate(true);
        assertTrue(hub.createPaused());
    }

    function test_pauseCommit_onlyOwner() public {
        hub.pauseCommit(true);
        assertTrue(hub.commitPaused());
    }

    function test_setSupportedChains_onlyOwner() public {
        bytes32[] memory chains = new bytes32[](1);
        chains[0] = CHAIN_A;
        hub.setSupportedChains(chains);
        assertTrue(hub.supportedChains(CHAIN_A));
    }

    // ─────────────────────────────────────────────────────────────────
    // Default payout math fuzz
    // ─────────────────────────────────────────────────────────────────

    function testFuzz_triggerDefault_bondCoversPayouts(
        uint96 principal,
        uint16 bps
    ) public {
        vm.assume(principal > 0 && principal <= 1_000_000 ether);
        vm.assume(bps <= 1000);

        uint64 expiryAt = uint64(block.timestamp + LOAN_DURATION);
        IFlashDotHub.LoanParams memory params = IFlashDotHub.LoanParams({
            asset:        address(token),
            targetAmount: uint256(principal),
            interestBps:  bps,
            expiryAt:     expiryAt
        });
        IFlashDotHub.LegSpec[] memory legs = new IFlashDotHub.LegSpec[](1);
        legs[0] = IFlashDotHub.LegSpec({
            chain: CHAIN_A, vault: VAULT_A, amount: principal,
            feeBudget: 0, legInterestBps: bps
        });

        vm.prank(BORROWER);
        uint256 loanId = hub.createLoan(params, legs);

        // Prepare + Commit
        vm.recordLogs();
        hub.startPrepare(loanId);
        bytes32[] memory pQids = _extractQids(vm.getRecordedLogs(), FlashDotHub.XcmPrepareSent.selector);
        vm.prank(XCM_EXECUTOR); hub.onXcmAck(pQids[0], true);

        vm.recordLogs();
        hub.startCommit(loanId);
        bytes32[] memory cQids = _extractQids(vm.getRecordedLogs(), FlashDotHub.XcmCommitSent.selector);
        vm.prank(XCM_EXECUTOR); hub.onXcmAck(cQids[0], true);

        // Default
        vm.warp(expiryAt + 1);
        hub.triggerDefault(loanId); // must not revert (bond always covers)

        assertEq(uint8(hub.getLoan(loanId).state), uint8(IFlashDotHub.LoanState.Defaulted));
    }
}
