// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IXcmPrecompile} from "./IXcmPrecompile.sol";

/// @title IMockXcm
/// @notice Mock interface for testing XCM interactions.
///         Allows tests to manually trigger ACK callbacks without real XCM.
interface IMockXcm is IXcmPrecompile {
    /// @notice Simulate an XCM acknowledgement callback from a vault.
    ///         In production this is called by the XCM precompile; in tests, by the test harness.
    ///
    /// @param hub      Address of the FlashDotHub contract to call onXcmAck on
    /// @param queryId  The query ID that was registered during xcmTransact
    /// @param success  true = vault ACK success (prepared/committed); false = failure
    function simulateAck(address hub, bytes32 queryId, bool success) external;

    /// @notice Returns all XCM calls recorded by this mock (for assertion in tests)
    function getRecordedCalls() external view returns (RecordedCall[] memory);

    /// @notice Clear recorded calls between test cases
    function clearRecordedCalls() external;

    struct RecordedCall {
        bytes   dest;
        bytes   call;
        uint64  weight;
        bytes32 queryId;
        bytes   callbackDest;
        uint256 value;       // msg.value at time of call
    }
}
