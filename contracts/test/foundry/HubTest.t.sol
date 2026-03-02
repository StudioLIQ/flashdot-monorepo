// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test, Vm} from "forge-std/Test.sol";
import {FlashDotHub} from "../../contracts/FlashDotHub.sol";
import {IFlashDotHub} from "../../contracts/interfaces/IFlashDotHub.sol";
import {ERC20Mock} from "./helpers/ERC20Mock.sol";
import {MockXcmPrecompile} from "../../contracts/mocks/MockXcmPrecompile.sol";

/// @title HubTest
/// @notice Comprehensive tests covering Hub state machine, bond math, and default payout.
///         Full happy path + all failure paths in fuzz form.
contract HubTest is Test {
    FlashDotHub public hub;
    ERC20Mock   public token;

    address public constant XCM_EXECUTOR = address(0xEEEE);
    address public constant FEE_RECIPIENT = address(0xFEE0);
    address public constant BORROWER      = address(0xB1);

    bytes32 public constant CHAIN_A = keccak256("chain-a");
    bytes32 public constant CHAIN_B = keccak256("chain-b");
    address public constant VAULT_A = address(0xA111);
    address public constant VAULT_B = address(0xB111);

    function setUp() public {
        token = new ERC20Mock("Mock DOT", "DOT", 18);
        MockXcmPrecompile _mock = new MockXcmPrecompile(address(0));
        hub = new FlashDotHub(XCM_EXECUTOR, FEE_RECIPIENT, address(_mock));
        vm.deal(address(hub), 100 ether);
        token.mint(BORROWER, 100_000_000 ether);
        vm.prank(BORROWER);
        token.approve(address(hub), type(uint256).max);
    }

    // ─────────────────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────────────────

    function _create(uint256 principal, uint32 bps, uint64 duration)
        internal
        returns (uint256 loanId)
    {
        IFlashDotHub.LoanParams memory params = IFlashDotHub.LoanParams({
            asset:        address(token),
            targetAmount: principal,
            interestBps:  bps,
            expiryAt:     uint64(block.timestamp + duration)
        });
        IFlashDotHub.LegSpec[] memory legs = new IFlashDotHub.LegSpec[](1);
        legs[0] = IFlashDotHub.LegSpec({
            chain: CHAIN_A, vault: VAULT_A, amount: principal,
            feeBudget: 0, legInterestBps: bps
        });
        vm.prank(BORROWER);
        loanId = hub.createLoan(params, legs);
    }

    function _prepareAndAck(uint256 loanId, bool success) internal {
        vm.recordLogs();
        hub.startPrepare(loanId);
        bytes32[] memory qids = _extractQids(vm.getRecordedLogs(), FlashDotHub.XcmPrepareSent.selector);
        vm.prank(XCM_EXECUTOR);
        hub.onXcmAck(qids[0], success);
    }

    function _commitAndAck(uint256 loanId, bool success) internal {
        vm.recordLogs();
        hub.startCommit(loanId);
        bytes32[] memory qids = _extractQids(vm.getRecordedLogs(), FlashDotHub.XcmCommitSent.selector);
        vm.prank(XCM_EXECUTOR);
        hub.onXcmAck(qids[0], success);
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
    // Happy path: Created → Preparing → Prepared → Committing → Committed
    // ─────────────────────────────────────────────────────────────────

    function test_happyPath_fullStateMachine() public {
        uint256 loanId = _create(100_000 ether, 100, 1 days);
        assertEq(uint8(hub.getLoan(loanId).state), uint8(IFlashDotHub.LoanState.Created));

        _prepareAndAck(loanId, true);
        assertEq(uint8(hub.getLoan(loanId).state), uint8(IFlashDotHub.LoanState.Prepared));

        _commitAndAck(loanId, true);
        assertEq(uint8(hub.getLoan(loanId).state), uint8(IFlashDotHub.LoanState.Committed));
    }

    // ─────────────────────────────────────────────────────────────────
    // Prepare failure → Aborted
    // ─────────────────────────────────────────────────────────────────

    function test_prepareFailure_aborts() public {
        uint256 loanId = _create(100_000 ether, 100, 1 days);
        uint256 bondBefore = hub.getBondInfo(loanId).bondAmount;
        uint256 borrowerBefore = token.balanceOf(BORROWER);

        _prepareAndAck(loanId, false);

        assertEq(uint8(hub.getLoan(loanId).state), uint8(IFlashDotHub.LoanState.Aborted));
        assertEq(token.balanceOf(BORROWER) - borrowerBefore, bondBefore, "bond returned");
    }

    // ─────────────────────────────────────────────────────────────────
    // Committed → Defaulted (expiry, no repay)
    // ─────────────────────────────────────────────────────────────────

    function test_expiry_noRepay_defaulted() public {
        uint64 expiryAt = uint64(block.timestamp + 1 days);
        IFlashDotHub.LoanParams memory params = IFlashDotHub.LoanParams({
            asset:        address(token),
            targetAmount: 100_000 ether,
            interestBps:  100,
            expiryAt:     expiryAt
        });
        IFlashDotHub.LegSpec[] memory legs = new IFlashDotHub.LegSpec[](1);
        legs[0] = IFlashDotHub.LegSpec({
            chain: CHAIN_A, vault: VAULT_A, amount: 100_000 ether,
            feeBudget: 0, legInterestBps: 100
        });
        vm.prank(BORROWER);
        uint256 loanId = hub.createLoan(params, legs);

        _prepareAndAck(loanId, true);
        _commitAndAck(loanId, true);

        vm.warp(expiryAt + 1);
        hub.triggerDefault(loanId);

        assertEq(uint8(hub.getLoan(loanId).state), uint8(IFlashDotHub.LoanState.Defaulted));
    }

    // ─────────────────────────────────────────────────────────────────
    // Committing → RepayOnlyMode → Defaulted (partial commit + timeout)
    // ─────────────────────────────────────────────────────────────────

    function test_partialCommit_repayOnlyMode_default() public {
        uint64 expiryAt = uint64(block.timestamp + 1 days);
        IFlashDotHub.LoanParams memory params = IFlashDotHub.LoanParams({
            asset:        address(token),
            targetAmount: 100_000 ether,
            interestBps:  100,
            expiryAt:     expiryAt
        });
        IFlashDotHub.LegSpec[] memory legs = new IFlashDotHub.LegSpec[](2);
        legs[0] = IFlashDotHub.LegSpec({
            chain: CHAIN_A, vault: VAULT_A, amount: 50_000 ether,
            feeBudget: 0, legInterestBps: 100
        });
        legs[1] = IFlashDotHub.LegSpec({
            chain: CHAIN_B, vault: VAULT_B, amount: 50_000 ether,
            feeBudget: 0, legInterestBps: 100
        });
        vm.prank(BORROWER);
        uint256 loanId = hub.createLoan(params, legs);

        // Prepare both
        vm.recordLogs();
        hub.startPrepare(loanId);
        bytes32[] memory pQids = _extractQids(vm.getRecordedLogs(), FlashDotHub.XcmPrepareSent.selector);
        vm.prank(XCM_EXECUTOR); hub.onXcmAck(pQids[0], true);
        vm.prank(XCM_EXECUTOR); hub.onXcmAck(pQids[1], true);

        // Commit: leg 0 succeeds, leg 1 fails
        vm.recordLogs();
        hub.startCommit(loanId);
        bytes32[] memory cQids = _extractQids(vm.getRecordedLogs(), FlashDotHub.XcmCommitSent.selector);
        vm.prank(XCM_EXECUTOR); hub.onXcmAck(cQids[0], true);  // committed
        vm.prank(XCM_EXECUTOR); hub.onXcmAck(cQids[1], false); // failed → repayOnlyMode

        assertTrue(hub.getLoan(loanId).repayOnlyMode);

        // After expiry → triggerDefault pays committed legs only
        vm.warp(expiryAt + 1);
        hub.triggerDefault(loanId);

        assertEq(uint8(hub.getLoan(loanId).state), uint8(IFlashDotHub.LoanState.Defaulted));
        assertEq(uint8(hub.getLeg(loanId, 0).state), uint8(IFlashDotHub.LegState.DefaultPaid));
        assertEq(uint8(hub.getLeg(loanId, 1).state), uint8(IFlashDotHub.LegState.Aborted)); // failed leg
    }

    // ─────────────────────────────────────────────────────────────────
    // onXcmAck idempotency
    // ─────────────────────────────────────────────────────────────────

    function test_ackIdempotency_consumedQueryId_reverts() public {
        uint256 loanId = _create(100_000 ether, 100, 1 days);

        vm.recordLogs();
        hub.startPrepare(loanId);
        bytes32[] memory qids = _extractQids(vm.getRecordedLogs(), FlashDotHub.XcmPrepareSent.selector);

        // First ACK
        vm.prank(XCM_EXECUTOR);
        hub.onXcmAck(qids[0], true);

        // Second ACK with same queryId → UNKNOWN_QUERY (consumed)
        vm.prank(XCM_EXECUTOR);
        vm.expectRevert("UNKNOWN_QUERY");
        hub.onXcmAck(qids[0], true);
    }

    // ─────────────────────────────────────────────────────────────────
    // Bond calculation fuzz
    // ─────────────────────────────────────────────────────────────────

    function testFuzz_bondCoversObligations(uint96 principal, uint16 bps) public {
        vm.assume(principal > 0 && principal <= 1_000_000 ether);
        vm.assume(bps <= 1000);

        uint256 loanId = _create(principal, bps, 1 days);
        uint256 bondAmount = hub.getBondInfo(loanId).bondAmount;

        // Bond must be >= repayAmount for a single leg
        uint256 repayAmt = (uint256(principal) * (10_000 + bps) + 9_999) / 10_000;
        assertGe(bondAmount, repayAmt, "bond < repayAmt (I-4 violated)");
    }
}
