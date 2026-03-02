// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IXcmPrecompile} from "../interfaces/IXcmPrecompile.sol";
import {IFlashDotHub} from "../interfaces/IFlashDotHub.sol";

/// @title MockXcmPrecompile
/// @notice Test mock for the Polkadot Hub XCM precompile.
///         Records all xcmTransact calls and allows manual ACK simulation.
///         Used in unit tests to avoid requiring a real Polkadot network.
contract MockXcmPrecompile is IXcmPrecompile {
    // ─────────────────────────────────────────────────────────────────
    // Types
    // ─────────────────────────────────────────────────────────────────

    struct RecordedCall {
        bytes   dest;
        bytes   call;
        uint64  weight;
        bytes32 queryId;
        bytes   callbackDest;
        uint256 value;
    }

    // ─────────────────────────────────────────────────────────────────
    // State
    // ─────────────────────────────────────────────────────────────────

    RecordedCall[] private _calls;
    mapping(bytes32 => bool) public queryExists;

    /// @notice Hub contract address that receives ACK callbacks
    address public hub;

    // ─────────────────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────────────────

    constructor(address _hub) {
        hub = _hub;
    }

    // ─────────────────────────────────────────────────────────────────
    // IXcmPrecompile
    // ─────────────────────────────────────────────────────────────────

    /// @inheritdoc IXcmPrecompile
    function xcmTransact(
        bytes calldata dest,
        bytes calldata call,
        uint64 weight,
        bytes32 queryId,
        bytes calldata callbackDest
    ) external payable returns (bool success) {
        _calls.push(RecordedCall({
            dest:         dest,
            call:         call,
            weight:       weight,
            queryId:      queryId,
            callbackDest: callbackDest,
            value:        msg.value
        }));
        queryExists[queryId] = true;
        return true;
    }

    // ─────────────────────────────────────────────────────────────────
    // Test helpers
    // ─────────────────────────────────────────────────────────────────

    /// @notice Simulate an XCM ACK callback for a given queryId.
    ///         Calls hub.onXcmAck(queryId, success) as if the XCM executor delivered it.
    /// @param queryId The query ID to ACK
    /// @param success true = vault operation succeeded; false = failed
    function simulateAck(bytes32 queryId, bool success) external {
        require(queryExists[queryId], "MOCK: UNKNOWN_QUERY");
        queryExists[queryId] = false; // mark consumed
        IFlashDotHub(hub).onXcmAck(queryId, success);
    }

    /// @notice Batch simulate multiple ACKs (all success or all failure)
    function simulateAckBatch(bytes32[] calldata queryIds, bool success) external {
        for (uint256 i = 0; i < queryIds.length; i++) {
            if (queryExists[queryIds[i]]) {
                queryExists[queryIds[i]] = false;
                IFlashDotHub(hub).onXcmAck(queryIds[i], success);
            }
        }
    }

    /// @notice Return all recorded XCM calls (for assertion in tests)
    function getRecordedCalls() external view returns (RecordedCall[] memory) {
        return _calls;
    }

    /// @notice Return the number of XCM calls recorded
    function callCount() external view returns (uint256) {
        return _calls.length;
    }

    /// @notice Clear all recorded calls (between test cases)
    function clearRecordedCalls() external {
        delete _calls;
    }

    /// @notice Update hub address (in case it's deployed after mock)
    function setHub(address _hub) external {
        hub = _hub;
    }
}
