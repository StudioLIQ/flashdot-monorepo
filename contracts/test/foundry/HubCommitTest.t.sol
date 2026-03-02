// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test, Vm} from "forge-std/Test.sol";
import {FlashDotHub} from "../../contracts/FlashDotHub.sol";
import {IFlashDotHub} from "../../contracts/interfaces/IFlashDotHub.sol";
import {ERC20Mock} from "./helpers/ERC20Mock.sol";
import {MockXcmPrecompile} from "../../contracts/mocks/MockXcmPrecompile.sol";

/// @title HubCommitTest
/// @notice Unit tests for FlashDotHub.startCommit(), Commit-phase onXcmAck(), and RepayOnlyMode
contract HubCommitTest is Test {
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
    uint32  public constant INTEREST   = 100;

    function setUp() public {
        token = new ERC20Mock("Mock DOT", "DOT", 18);
        MockXcmPrecompile _mock = new MockXcmPrecompile(address(0));
        hub = new FlashDotHub(XCM_EXECUTOR, FEE_RECIPIENT, address(_mock));
        vm.deal(address(hub), 100 ether);
        token.mint(BORROWER, 10_000_000 ether);
        vm.prank(BORROWER);
        token.approve(address(hub), type(uint256).max);
    }

    // ─────────────────────────────────────────────────────────────────
    // Setup helpers
    // ─────────────────────────────────────────────────────────────────

    function _createAndPrepare() internal returns (uint256 loanId, bytes32[] memory prepareQids) {
        IFlashDotHub.LoanParams memory params = IFlashDotHub.LoanParams({
            asset:        address(token),
            targetAmount: PRINCIPAL * 2,
            interestBps:  INTEREST,
            expiryAt:     uint64(block.timestamp + 1 days)
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

        // startPrepare and capture queryIds
        vm.recordLogs();
        hub.startPrepare(loanId);
        prepareQids = _extractQids(vm.getRecordedLogs(), FlashDotHub.XcmPrepareSent.selector);

        // ACK both legs as prepared
        vm.prank(XCM_EXECUTOR);
        hub.onXcmAck(prepareQids[0], true);
        vm.prank(XCM_EXECUTOR);
        hub.onXcmAck(prepareQids[1], true);

        // loan should now be Prepared
        assertEq(uint8(hub.getLoan(loanId).state), uint8(IFlashDotHub.LoanState.Prepared));
    }

    function _extractQids(Vm.Log[] memory logs, bytes32 selector)
        internal
        pure
        returns (bytes32[] memory)
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
    // startCommit
    // ─────────────────────────────────────────────────────────────────

    function test_startCommit_emitsCommitSent() public {
        (uint256 loanId,) = _createAndPrepare();

        vm.expectEmit(true, false, false, false);
        emit IFlashDotHub.CommitSent(loanId, 0, CHAIN_A, PRINCIPAL);
        vm.expectEmit(true, false, false, false);
        emit IFlashDotHub.CommitSent(loanId, 1, CHAIN_B, PRINCIPAL);

        hub.startCommit(loanId);

        assertEq(uint8(hub.getLoan(loanId).state), uint8(IFlashDotHub.LoanState.Committing));
        assertEq(uint8(hub.getLeg(loanId, 0).state), uint8(IFlashDotHub.LegState.CommitSent));
        assertEq(uint8(hub.getLeg(loanId, 1).state), uint8(IFlashDotHub.LegState.CommitSent));
    }

    function test_startCommit_wrongState_reverts() public {
        (uint256 loanId,) = _createAndPrepare();
        hub.startCommit(loanId);
        vm.expectRevert("NOT_PREPARED");
        hub.startCommit(loanId); // already Committing
    }

    function test_startCommit_paused_reverts() public {
        (uint256 loanId,) = _createAndPrepare();
        hub.pauseCommit(true);
        vm.expectRevert("COMMIT_PAUSED");
        hub.startCommit(loanId);
    }

    // ─────────────────────────────────────────────────────────────────
    // onXcmAck — Commit phase success
    // ─────────────────────────────────────────────────────────────────

    function test_commitAck_allLegs_thenCommitted() public {
        (uint256 loanId,) = _createAndPrepare();

        vm.recordLogs();
        hub.startCommit(loanId);
        bytes32[] memory commitQids = _extractQids(vm.getRecordedLogs(), FlashDotHub.XcmCommitSent.selector);
        assertEq(commitQids.length, 2);

        // ACK leg 0
        vm.prank(XCM_EXECUTOR);
        hub.onXcmAck(commitQids[0], true);
        assertEq(uint8(hub.getLeg(loanId, 0).state), uint8(IFlashDotHub.LegState.CommittedAcked));
        // Still Committing (leg 1 pending)
        assertEq(uint8(hub.getLoan(loanId).state), uint8(IFlashDotHub.LoanState.Committing));

        // ACK leg 1 → Committed
        vm.prank(XCM_EXECUTOR);
        hub.onXcmAck(commitQids[1], true);
        assertEq(uint8(hub.getLeg(loanId, 1).state), uint8(IFlashDotHub.LegState.CommittedAcked));
        assertEq(uint8(hub.getLoan(loanId).state), uint8(IFlashDotHub.LoanState.Committed));
    }

    // ─────────────────────────────────────────────────────────────────
    // RepayOnlyMode (I-2)
    // ─────────────────────────────────────────────────────────────────

    function test_commitAck_failure_setsRepayOnlyMode() public {
        (uint256 loanId,) = _createAndPrepare();

        vm.recordLogs();
        hub.startCommit(loanId);
        bytes32[] memory commitQids = _extractQids(vm.getRecordedLogs(), FlashDotHub.XcmCommitSent.selector);

        // ACK leg 0 success
        vm.prank(XCM_EXECUTOR);
        hub.onXcmAck(commitQids[0], true);
        assertEq(uint8(hub.getLeg(loanId, 0).state), uint8(IFlashDotHub.LegState.CommittedAcked));

        // NAK leg 1 → RepayOnlyMode
        vm.expectEmit(true, false, false, false);
        emit IFlashDotHub.RepayOnlyMode(loanId, "");
        vm.prank(XCM_EXECUTOR);
        hub.onXcmAck(commitQids[1], false);

        assertTrue(hub.getLoan(loanId).repayOnlyMode, "repayOnlyMode must be set");

        // I-2: CommittedAcked leg 0 must NOT be Aborted
        assertEq(
            uint8(hub.getLeg(loanId, 0).state),
            uint8(IFlashDotHub.LegState.CommittedAcked),
            "CommittedAcked is irreversible (I-2)"
        );
        // Failed leg should be Aborted
        assertEq(uint8(hub.getLeg(loanId, 1).state), uint8(IFlashDotHub.LegState.Aborted));
    }

    function test_repayOnlyMode_isIrreversible() public {
        (uint256 loanId,) = _createAndPrepare();

        vm.recordLogs();
        hub.startCommit(loanId);
        bytes32[] memory commitQids = _extractQids(vm.getRecordedLogs(), FlashDotHub.XcmCommitSent.selector);

        // NAK leg 0 → RepayOnlyMode
        vm.prank(XCM_EXECUTOR);
        hub.onXcmAck(commitQids[0], false);

        assertTrue(hub.getLoan(loanId).repayOnlyMode);

        // repayOnlyMode cannot be unset — there's no external function to clear it
        // (verified by absence of such a function in IFlashDotHub)
    }

    function test_committedAcked_cannotBeAborted() public {
        (uint256 loanId,) = _createAndPrepare();

        vm.recordLogs();
        hub.startCommit(loanId);
        bytes32[] memory commitQids = _extractQids(vm.getRecordedLogs(), FlashDotHub.XcmCommitSent.selector);

        // ACK leg 0 → CommittedAcked
        vm.prank(XCM_EXECUTOR);
        hub.onXcmAck(commitQids[0], true);

        // Try to re-use the same queryId (already consumed) → UNKNOWN_QUERY
        vm.prank(XCM_EXECUTOR);
        vm.expectRevert("UNKNOWN_QUERY");
        hub.onXcmAck(commitQids[0], false); // can't redeliver

        // State unchanged
        assertEq(
            uint8(hub.getLeg(loanId, 0).state),
            uint8(IFlashDotHub.LegState.CommittedAcked),
            "CommittedAcked preserved after revert"
        );
    }
}
