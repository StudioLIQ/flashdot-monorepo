// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test, Vm} from "forge-std/Test.sol";
import {FlashDotHub} from "../../contracts/FlashDotHub.sol";
import {MockXcmPrecompile} from "../../contracts/mocks/MockXcmPrecompile.sol";
import {IFlashDotHub} from "../../contracts/interfaces/IFlashDotHub.sol";
import {XcmEncoder} from "../../contracts/lib/XcmEncoder.sol";
import {ERC20Mock} from "./helpers/ERC20Mock.sol";

/// @title MockXcmTest
/// @notice Tests for XcmEncoder library and MockXcmPrecompile contract.
///         Verifies encoding output and simulateAck flow.
contract MockXcmTest is Test {
    FlashDotHub        public hub;
    MockXcmPrecompile  public mockXcm;
    ERC20Mock          public token;

    address public constant FEE_RECIPIENT = address(0xFEE0);
    address public constant BORROWER      = address(0xB1);

    bytes32 public constant CHAIN_A = keccak256("chain-a");
    address public constant VAULT_A = address(0xA111);

    uint256 public constant PRINCIPAL = 50_000 ether;
    uint32  public constant INTEREST  = 100;

    function setUp() public {
        token = new ERC20Mock("Mock DOT", "DOT", 18);

        // Deploy hub with mock XCM as executor (mock will be the XCM sender)
        // MockXcm needs hub address, and hub needs mock address as XCM_EXECUTOR
        // We use a two-step deploy: deploy mock first with placeholder, then set hub
        mockXcm = new MockXcmPrecompile(address(0)); // placeholder
        // XCM_EXECUTOR = address(mockXcm) so simulateAck() calls onXcmAck as executor
        hub = new FlashDotHub(address(mockXcm), FEE_RECIPIENT, address(mockXcm));
        mockXcm.setHub(address(hub));

        token.mint(BORROWER, 10_000_000 ether);
        vm.prank(BORROWER);
        token.approve(address(hub), type(uint256).max);
    }

    // ─────────────────────────────────────────────────────────────────
    // XcmEncoder library tests
    // ─────────────────────────────────────────────────────────────────

    function test_encodePrepareCall_selector() public pure {
        bytes memory callData = XcmEncoder.encodePrepareCall(
            VAULT_A,
            1,
            50_000 ether,
            51_000 ether,
            uint64(1000),
            address(0xBEEF),
            bytes32(0)
        );
        // First 4 bytes = selector of prepare(uint256,uint256,uint256,uint64,address,bytes32)
        bytes4 expected = bytes4(keccak256("prepare(uint256,uint256,uint256,uint64,address,bytes32)"));
        bytes4 actual;
        assembly { actual := mload(add(callData, 32)) }
        assertEq(actual, expected, "selector mismatch");
    }

    function test_encodeCommitCall_selector() public pure {
        bytes memory callData = XcmEncoder.encodeCommitCall(42);
        bytes4 expected = bytes4(keccak256("commit(uint256)"));
        bytes4 actual;
        assembly { actual := mload(add(callData, 32)) }
        assertEq(actual, expected, "selector mismatch");
    }

    function test_encodeParachainLocation_format() public pure {
        bytes memory loc = XcmEncoder.encodeParachainLocation(2000);
        assertEq(loc.length, 7);
        assertEq(uint8(loc[0]), 0x01, "parents = 1");
        assertEq(uint8(loc[1]), 0x01, "X1 interior");
        assertEq(uint8(loc[2]), 0x00, "Parachain junction");
        // 2000 = 0x000007D0 → little-endian: D0 07 00 00
        assertEq(uint8(loc[3]), 0xD0);
        assertEq(uint8(loc[4]), 0x07);
        assertEq(uint8(loc[5]), 0x00);
        assertEq(uint8(loc[6]), 0x00);
    }

    function test_encodeHubLocation_here() public pure {
        bytes memory loc = XcmEncoder.encodeHubLocation();
        assertEq(loc.length, 2);
        assertEq(uint8(loc[0]), 0x00, "parents = 0");
        assertEq(uint8(loc[1]), 0x00, "Here");
    }

    // ─────────────────────────────────────────────────────────────────
    // MockXcmPrecompile: simulateAck integration with Hub
    // ─────────────────────────────────────────────────────────────────

    function test_simulateAck_prepare_success() public {
        uint256 loanId = _createLoan();

        // startPrepare emits XcmPrepareSent with queryId
        vm.recordLogs();
        hub.startPrepare(loanId);
        bytes32[] memory qids = _extractQids(vm.getRecordedLogs(), FlashDotHub.XcmPrepareSent.selector);
        assertEq(qids.length, 1, "expected 1 XcmPrepareSent");
        assertTrue(mockXcm.queryExists(qids[0]), "query registered in mock");

        // Simulate success ACK → Hub processes PreparedAcked
        mockXcm.simulateAck(qids[0], true);

        assertEq(uint8(hub.getLoan(loanId).state), uint8(IFlashDotHub.LoanState.Prepared));
        assertEq(uint8(hub.getLeg(loanId, 0).state), uint8(IFlashDotHub.LegState.PreparedAcked));
    }

    function test_simulateAck_prepare_failure_abortsLoan() public {
        uint256 loanId = _createLoan();
        uint256 bondAmount = hub.getBondInfo(loanId).bondAmount;
        uint256 bBefore = token.balanceOf(BORROWER);

        vm.recordLogs();
        hub.startPrepare(loanId);
        bytes32[] memory qids = _extractQids(vm.getRecordedLogs(), FlashDotHub.XcmPrepareSent.selector);

        mockXcm.simulateAck(qids[0], false);

        assertEq(uint8(hub.getLoan(loanId).state), uint8(IFlashDotHub.LoanState.Aborted));
        assertEq(token.balanceOf(BORROWER) - bBefore, bondAmount, "bond returned");
    }

    function test_simulateAck_unknownQuery_reverts() public {
        vm.expectRevert("MOCK: UNKNOWN_QUERY");
        mockXcm.simulateAck(keccak256("fake"), true);
    }

    function test_mockXcm_recordsCalls() public {
        uint256 loanId = _createLoan();
        hub.startPrepare(loanId);

        assertEq(mockXcm.callCount(), 1, "one XCM call recorded");
        MockXcmPrecompile.RecordedCall[] memory calls = mockXcm.getRecordedCalls();
        assertEq(calls.length, 1);
        assertTrue(calls[0].queryId != bytes32(0), "queryId recorded");
    }

    // ─────────────────────────────────────────────────────────────────
    // Full flow through MockXcm
    // ─────────────────────────────────────────────────────────────────

    function test_fullFlow_viaMockXcm() public {
        uint64 expiryAt = uint64(block.timestamp + 1 days);
        IFlashDotHub.LoanParams memory params = IFlashDotHub.LoanParams({
            asset:        address(token),
            targetAmount: PRINCIPAL,
            interestBps:  INTEREST,
            expiryAt:     expiryAt
        });
        IFlashDotHub.LegSpec[] memory legs = new IFlashDotHub.LegSpec[](1);
        legs[0] = IFlashDotHub.LegSpec({
            chain: CHAIN_A, vault: VAULT_A, amount: PRINCIPAL,
            feeBudget: 0, legInterestBps: INTEREST
        });

        vm.prank(BORROWER);
        uint256 loanId = hub.createLoan(params, legs);

        // Prepare
        vm.recordLogs();
        hub.startPrepare(loanId);
        bytes32[] memory pQids = _extractQids(vm.getRecordedLogs(), FlashDotHub.XcmPrepareSent.selector);
        mockXcm.simulateAck(pQids[0], true);
        assertEq(uint8(hub.getLoan(loanId).state), uint8(IFlashDotHub.LoanState.Prepared));

        // Commit
        vm.recordLogs();
        hub.startCommit(loanId);
        bytes32[] memory cQids = _extractQids(vm.getRecordedLogs(), FlashDotHub.XcmCommitSent.selector);
        mockXcm.simulateAck(cQids[0], true);
        assertEq(uint8(hub.getLoan(loanId).state), uint8(IFlashDotHub.LoanState.Committed));

        assertEq(mockXcm.callCount(), 2, "prepare + commit = 2 XCM calls");
    }

    // ─────────────────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────────────────

    function _createLoan() internal returns (uint256 loanId) {
        IFlashDotHub.LoanParams memory params = IFlashDotHub.LoanParams({
            asset:        address(token),
            targetAmount: PRINCIPAL,
            interestBps:  INTEREST,
            expiryAt:     uint64(block.timestamp + 1 days)
        });
        IFlashDotHub.LegSpec[] memory legs = new IFlashDotHub.LegSpec[](1);
        legs[0] = IFlashDotHub.LegSpec({
            chain: CHAIN_A, vault: VAULT_A, amount: PRINCIPAL,
            feeBudget: 0, legInterestBps: INTEREST
        });
        vm.prank(BORROWER);
        loanId = hub.createLoan(params, legs);
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
}
