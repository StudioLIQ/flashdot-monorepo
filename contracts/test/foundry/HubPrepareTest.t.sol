// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test, Vm} from "forge-std/Test.sol";
import {FlashDotHub} from "../../contracts/FlashDotHub.sol";
import {IFlashDotHub} from "../../contracts/interfaces/IFlashDotHub.sol";
import {ERC20Mock} from "./helpers/ERC20Mock.sol";
import {MockXcmPrecompile} from "../../contracts/mocks/MockXcmPrecompile.sol";

/// @title HubPrepareTest
/// @notice Unit tests for FlashDotHub.startPrepare() and Prepare-phase onXcmAck()
contract HubPrepareTest is Test {
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

    function setUp() public {
        token = new ERC20Mock("Mock DOT", "DOT", 18);
        MockXcmPrecompile _mock = new MockXcmPrecompile(address(0));
        hub = new FlashDotHub(XCM_EXECUTOR, FEE_RECIPIENT, address(_mock));
        vm.deal(address(hub), 100 ether);
        token.mint(BORROWER, 10_000_000 ether);
        vm.prank(BORROWER);
        token.approve(address(hub), type(uint256).max);
    }

    function _createTwoLegLoan() internal returns (uint256 loanId) {
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
    }

    /// @dev Capture queryIds emitted during startPrepare
    function _startPrepareAndGetQueryIds(uint256 loanId)
        internal
        returns (bytes32 qId0, bytes32 qId1)
    {
        vm.recordLogs();
        hub.startPrepare(loanId);

        // Parse XcmPrepareSent events
        Vm.Log[] memory logs = vm.getRecordedLogs();
        uint256 found = 0;
        bytes32[2] memory qIds;
        for (uint256 i = 0; i < logs.length; i++) {
            if (logs[i].topics[0] == FlashDotHub.XcmPrepareSent.selector) {
                (, , , bytes32 qid) = abi.decode(logs[i].data, (uint256, bytes32, address, bytes32));
                qIds[found] = qid;
                found++;
            }
        }
        qId0 = qIds[0];
        qId1 = qIds[1];
    }

    // ─────────────────────────────────────────────────────────────────
    // startPrepare
    // ─────────────────────────────────────────────────────────────────

    function test_startPrepare_emitsPrepareSent() public {
        uint256 loanId = _createTwoLegLoan();

        vm.expectEmit(true, false, false, false);
        emit IFlashDotHub.PrepareSent(loanId, 0, CHAIN_A, PRINCIPAL);
        vm.expectEmit(true, false, false, false);
        emit IFlashDotHub.PrepareSent(loanId, 1, CHAIN_B, PRINCIPAL);

        hub.startPrepare(loanId);

        IFlashDotHub.Loan memory loan = hub.getLoan(loanId);
        assertEq(uint8(loan.state), uint8(IFlashDotHub.LoanState.Preparing));
        assertEq(uint8(hub.getLeg(loanId, 0).state), uint8(IFlashDotHub.LegState.PrepareSent));
        assertEq(uint8(hub.getLeg(loanId, 1).state), uint8(IFlashDotHub.LegState.PrepareSent));
    }

    function test_startPrepare_wrongState_reverts() public {
        uint256 loanId = _createTwoLegLoan();
        hub.startPrepare(loanId); // First call OK
        vm.expectRevert("NOT_CREATED");
        hub.startPrepare(loanId); // Second call fails
    }

    // ─────────────────────────────────────────────────────────────────
    // onXcmAck — Prepare phase success
    // ─────────────────────────────────────────────────────────────────

    function test_prepareAck_oneByOne_thenPrepared() public {
        uint256 loanId = _createTwoLegLoan();

        // Capture queryIds from startPrepare events
        vm.recordLogs();
        hub.startPrepare(loanId);
        Vm.Log[] memory logs = vm.getRecordedLogs();

        bytes32[] memory queryIds = _extractQueryIds(logs);
        assertEq(queryIds.length, 2, "expected 2 XcmPrepareSent events");

        // ACK leg 0
        vm.prank(XCM_EXECUTOR);
        hub.onXcmAck(queryIds[0], true);

        assertEq(uint8(hub.getLeg(loanId, 0).state), uint8(IFlashDotHub.LegState.PreparedAcked));
        assertEq(uint8(hub.getLoan(loanId).state), uint8(IFlashDotHub.LoanState.Preparing));

        // ACK leg 1 → loan → Prepared
        vm.prank(XCM_EXECUTOR);
        hub.onXcmAck(queryIds[1], true);

        assertEq(uint8(hub.getLeg(loanId, 1).state), uint8(IFlashDotHub.LegState.PreparedAcked));
        assertEq(uint8(hub.getLoan(loanId).state), uint8(IFlashDotHub.LoanState.Prepared));
    }

    // ─────────────────────────────────────────────────────────────────
    // onXcmAck — Prepare phase failure
    // ─────────────────────────────────────────────────────────────────

    function test_prepareAck_failure_abortsLoanReturnsBond() public {
        uint256 loanId = _createTwoLegLoan();
        uint256 bondAmount = hub.getBondInfo(loanId).bondAmount;

        vm.recordLogs();
        hub.startPrepare(loanId);
        bytes32[] memory queryIds = _extractQueryIds(vm.getRecordedLogs());

        uint256 borrowerBalBefore = token.balanceOf(BORROWER);

        // NAK on leg 0 → abort everything
        vm.prank(XCM_EXECUTOR);
        hub.onXcmAck(queryIds[0], false);

        assertEq(uint8(hub.getLoan(loanId).state), uint8(IFlashDotHub.LoanState.Aborted));
        assertEq(token.balanceOf(BORROWER) - borrowerBalBefore, bondAmount, "bond returned");
    }

    function test_onXcmAck_unknownQueryId_reverts() public {
        vm.prank(XCM_EXECUTOR);
        vm.expectRevert("UNKNOWN_QUERY");
        hub.onXcmAck(keccak256("garbage"), true);
    }

    function test_onXcmAck_wrongCaller_reverts() public {
        uint256 loanId = _createTwoLegLoan();
        vm.recordLogs();
        hub.startPrepare(loanId);
        bytes32[] memory queryIds = _extractQueryIds(vm.getRecordedLogs());

        vm.expectRevert("NOT_XCM_EXECUTOR");
        hub.onXcmAck(queryIds[0], true); // called as address(this), not XCM_EXECUTOR
    }

    // ─────────────────────────────────────────────────────────────────
    // Helper: extract queryIds from XcmPrepareSent logs
    // ─────────────────────────────────────────────────────────────────

    function _extractQueryIds(Vm.Log[] memory logs) internal pure returns (bytes32[] memory) {
        uint256 count = 0;
        for (uint256 i = 0; i < logs.length; i++) {
            if (logs[i].topics[0] == FlashDotHub.XcmPrepareSent.selector) count++;
        }
        bytes32[] memory ids = new bytes32[](count);
        uint256 idx = 0;
        for (uint256 i = 0; i < logs.length; i++) {
            if (logs[i].topics[0] == FlashDotHub.XcmPrepareSent.selector) {
                (, , , bytes32 qid) = abi.decode(logs[i].data, (uint256, bytes32, address, bytes32));
                ids[idx++] = qid;
            }
        }
        return ids;
    }
}
