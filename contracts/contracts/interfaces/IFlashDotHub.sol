// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title IFlashDotHub
/// @notice Interface for the FlashDot Hub contract deployed on Polkadot Hub EVM.
///         Manages the 2PC loan lifecycle, bond escrow, and XCM coordination.
interface IFlashDotHub {
    // ─────────────────────────────────────────────────────────────────
    // Enums
    // ─────────────────────────────────────────────────────────────────

    enum LoanState {
        Created,    // createLoan() called, bond locked
        Preparing,  // startPrepare() called, XCM prepare sent to all legs
        Prepared,   // all legs PreparedAcked
        Committing, // startCommit() called, XCM commit sent to all legs
        Committed,  // all legs CommittedAcked; borrower has funds
        Repaying,   // repay flow in progress
        Settling,   // finalizeSettle() in progress
        Settled,    // all repaid; bond returned (minus fees)
        Aborted,    // cancelled before or during Prepare phase
        Defaulted   // expiry passed without repay; bond slashed
    }

    enum LegState {
        Init,            // created, not yet sent
        PrepareSent,     // XCM prepare sent to vault
        PreparedAcked,   // vault confirmed funds locked
        CommitSent,      // XCM commit sent to vault
        CommittedAcked,  // vault confirmed funds disbursed (IRREVERSIBLE per I-2)
        RepaidConfirmed, // borrower repaid this leg
        Aborted,         // prepare/commit aborted
        DefaultPaid      // bond paid out to this leg
    }

    // ─────────────────────────────────────────────────────────────────
    // Structs
    // ─────────────────────────────────────────────────────────────────

    /// @notice Parameters for creating a new loan
    struct LoanParams {
        address asset;        // ERC-20 asset (DOT wrapped)
        uint256 targetAmount; // total amount to borrow across all legs
        uint32  interestBps;  // global interest in basis points (100 = 1%)
        uint64  expiryAt;     // unix timestamp (seconds); must be > now + MIN_LOAN_DURATION
    }

    /// @notice Specification for a single vault leg
    struct LegSpec {
        bytes32 chain;          // XCM MultiLocation hash of destination chain
        address vault;          // vault contract address on remote chain
        uint256 amount;         // principal to borrow from this vault
        uint256 feeBudget;      // max XCM fee budget (included in bond)
        uint32  legInterestBps; // per-leg interest override (0 = use global)
    }

    /// @notice Full loan state (stored on-chain)
    struct Loan {
        address borrower;
        address asset;
        uint256 targetAmount;
        uint32  interestBps;
        uint64  createdAt;
        uint64  expiryAt;
        LoanState state;
        bool    repayOnlyMode; // one-way flag; set on partial commit failure
        bytes32 planHash;      // keccak256(abi.encode(legSpecs)) for integrity
    }

    /// @notice Per-leg state (stored in legs mapping)
    struct Leg {
        bytes32 chain;
        address vault;
        uint256 amount;
        uint256 feeBudget;
        uint32  legInterestBps;
        LegState state;
    }

    /// @notice Bond escrow record
    struct BondInfo {
        uint256 bondAmount; // total bond locked
        uint64  lockedAt;   // when bond was locked
        bool    slashed;    // true after triggerDefault payout
    }

    // ─────────────────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────────────────

    event LoanCreated(
        uint256 indexed loanId,
        address borrower,
        address asset,
        uint256 targetAmount,
        uint256 bondAmount
    );
    event PrepareSent(
        uint256 indexed loanId,
        uint256 legId,
        bytes32 chain,
        uint256 amount
    );
    event PreparedAcked(
        uint256 indexed loanId,
        uint256 legId,
        bytes32 chain
    );
    event CommitSent(
        uint256 indexed loanId,
        uint256 legId,
        bytes32 chain,
        uint256 amount
    );
    event CommittedAcked(
        uint256 indexed loanId,
        uint256 legId,
        bytes32 chain
    );
    event RepayConfirmed(
        uint256 indexed loanId,
        uint256 legId,
        uint256 amount
    );
    event LoanAborted(uint256 indexed loanId, string reason);
    event RepayOnlyMode(uint256 indexed loanId, string reason);
    event LoanDefaulted(uint256 indexed loanId, uint256 slashedAmount);
    event LoanSettled(uint256 indexed loanId, uint256 hubFee);

    // ─────────────────────────────────────────────────────────────────
    // User-facing
    // ─────────────────────────────────────────────────────────────────

    /// @notice Create a new flash loan and lock bond.
    ///         Bond must cover: Σ ceil(amount_i × (1 + legBps_i/10000)) + Σ feeBudget_i + HUB_FEE_BUFFER
    /// @param params   Loan parameters (asset, targetAmount, interestBps, expiryAt)
    /// @param legSpecs Per-leg specifications (chain, vault, amount, feeBudget, interestBps)
    /// @return loanId  Unique loan identifier
    function createLoan(LoanParams calldata params, LegSpec[] calldata legSpecs) external returns (uint256 loanId);

    /// @notice Cancel loan before any commit is sent.
    ///         Returns bond minus cancellation fee. Reverts if state >= Committing.
    function cancelBeforeCommit(uint256 loanId) external;

    // ─────────────────────────────────────────────────────────────────
    // Coordinator-facing (permissionless)
    // ─────────────────────────────────────────────────────────────────

    /// @notice Kick off Phase 1: send XCM prepare to all vault legs.
    ///         Loan must be in Created state.
    function startPrepare(uint256 loanId) external;

    /// @notice Kick off Phase 2: send XCM commit to all PreparedAcked legs.
    ///         Loan must be in Prepared state.
    function startCommit(uint256 loanId) external;

    /// @notice Settle loan after all legs are RepaidConfirmed.
    ///         Returns bond minus hub fee to borrower.
    function finalizeSettle(uint256 loanId) external;

    /// @notice Trigger default after expiry. Slashes bond and pays committed legs.
    ///         Anyone can call after loan.expiryAt passes without full repay.
    function triggerDefault(uint256 loanId) external;

    // ─────────────────────────────────────────────────────────────────
    // XCM callback (called by XCM precompile on ACK)
    // ─────────────────────────────────────────────────────────────────

    /// @notice Handle XCM acknowledgement from a vault.
    ///         Only callable by the XCM executor address (onlyXcmExecutor).
    /// @param queryId Unique query ID registered during XCM send
    /// @param success true = vault ACK success; false = vault NAK / timeout
    function onXcmAck(bytes32 queryId, bool success) external;

    // ─────────────────────────────────────────────────────────────────
    // Emergency / Governance (onlyOwner)
    // ─────────────────────────────────────────────────────────────────

    function pauseCreate(bool paused) external;
    function pauseCommit(bool paused) external;
    function setSupportedChains(bytes32[] calldata chains) external;

    // ─────────────────────────────────────────────────────────────────
    // Views
    // ─────────────────────────────────────────────────────────────────

    function getLoan(uint256 loanId) external view returns (Loan memory);
    function getLeg(uint256 loanId, uint256 legId) external view returns (Leg memory);
    function getBondInfo(uint256 loanId) external view returns (BondInfo memory);
    function nextLoanId() external view returns (uint256);
}
