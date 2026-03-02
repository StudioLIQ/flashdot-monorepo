// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title IXcmPrecompile
/// @notice Interface for the Polkadot Hub XCM precompile.
///         Allows EVM contracts to send XCM messages to other parachains.
///
/// @dev Deployed at: 0x0000000000000000000000000000000000000800 (Polkadot Hub EVM)
///      Reference: https://docs.substrate.io/reference/xcm-reference/
interface IXcmPrecompile {
    /// @notice Address where this precompile is deployed on Polkadot Hub EVM
    // address public constant XCM_PRECOMPILE_ADDRESS = 0x0000000000000000000000000000000000000800;

    /// @notice Send an XCM Transact message to a remote chain.
    ///         The precompile handles encoding, fee deduction, and delivery.
    ///
    /// @param dest         SCALE-encoded MultiLocation of the destination chain
    ///                     Example (para 2000): 0x01 ++ uint32(2000, little-endian) ++ 0x00
    /// @param call         SCALE-encoded runtime call to execute on the remote chain
    ///                     For EVM calls: ethereum.transact(tx_bytes)
    /// @param weight       Weight limit for execution on the remote chain (ref_time)
    ///                     Conservative estimate; unused weight is refunded to feeBudget
    /// @param queryId      Unique identifier for tracking the XCM response.
    ///                     The precompile will call onXcmAck(queryId, success) on Hub.
    /// @param callbackDest SCALE-encoded MultiLocation where the response callback is sent
    ///                     For Hub callbacks: Hub's own MultiLocation (Here or Parent)
    ///
    /// @return success true if the XCM message was enqueued successfully
    function xcmTransact(
        bytes calldata dest,
        bytes calldata call,
        uint64 weight,
        bytes32 queryId,
        bytes calldata callbackDest
    ) external payable returns (bool success);
}

// Convenience constant for the XCM precompile address
address constant XCM_PRECOMPILE_ADDRESS = 0x0000000000000000000000000000000000000800;
