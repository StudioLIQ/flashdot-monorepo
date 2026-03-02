// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title IFlashDotVault
/// @notice Interface for FlashDot vault contracts deployed on parachain EVMs.
///         Vaults provide liquidity via a Two-Phase Commit protocol driven by the Hub.
/// @dev Pool invariant: total == available + reserved + borrowed (must hold at all times)
interface IFlashDotVault {
    // ─────────────────────────────────────────────────────────────────
    // Enums
    // ─────────────────────────────────────────────────────────────────

    enum VaultLoanState {
        Prepared,       // Funds locked (available → reserved)
        Committed,      // Funds disbursed (reserved → borrowed), sent to borrowerDest
        Repaid,         // Borrower repaid (borrowed → available)
        Aborted,        // Prepare cancelled before commit (reserved → available)
        DefaultClaimed  // Expiry passed without repay; Hub bond payout handled separately
    }

    // ─────────────────────────────────────────────────────────────────
    // Structs
    // ─────────────────────────────────────────────────────────────────

    /// @notice Per-loan state in this vault
    struct VaultLoan {
        uint256 principal;
        /// @dev repayAmount = ceil(principal * (10000 + interestBps) / 10000) — ceiling division
        uint256 repayAmount;
        uint64  expiryAt;       // unix timestamp (seconds)
        address borrowerDest;   // where committed funds are transferred
        bytes32 hubLoc;         // XCM location of Hub (for callbacks)
        VaultLoanState state;
    }

    /// @notice Aggregate pool liquidity state
    /// @dev Invariant: total == available + reserved + borrowed
    struct PoolState {
        uint256 total;      // all LP capital ever deposited minus withdrawn
        uint256 available;  // free to be lent
        uint256 reserved;   // locked during prepare phase (not yet disbursed)
        uint256 borrowed;   // currently disbursed to borrowers
    }

    // ─────────────────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────────────────

    event Deposited(address indexed lp, uint256 amount, uint256 shares);
    event Withdrawn(address indexed lp, uint256 shares, uint256 amount);
    event LoanPrepared(uint256 indexed loanId, uint256 principal, uint256 repayAmount, uint64 expiryAt);
    event LoanCommitted(uint256 indexed loanId, address borrowerDest, uint256 principal);
    event LoanAborted(uint256 indexed loanId);
    event LoanRepaid(uint256 indexed loanId, uint256 amount);
    event DefaultClaimed(uint256 indexed loanId, uint256 amount);

    // ─────────────────────────────────────────────────────────────────
    // LP Management (local only — no Hub auth required)
    // ─────────────────────────────────────────────────────────────────

    /// @notice Deposit `amount` of the vault asset and receive LP shares.
    ///         First depositor receives shares == amount (1:1).
    ///         Subsequent depositors receive pro-rata shares relative to pool.available.
    function deposit(uint256 amount) external returns (uint256 shares);

    /// @notice Burn `shares` and receive proportional pool.available tokens.
    ///         Reverts if pool.available < amount to withdraw.
    function withdraw(uint256 shares) external returns (uint256 amount);

    // ─────────────────────────────────────────────────────────────────
    // Vault Endpoints — onlyHubOrigin (Hub XCM sovereign account)
    // ─────────────────────────────────────────────────────────────────

    /// @notice Phase 1 of 2PC: lock `principal` in reserve for `loanId`.
    ///         Idempotency: same params → no-op; different params → revert.
    /// @param loanId     Unique loan identifier from Hub
    /// @param principal  Amount to lock (available → reserved)
    /// @param repayAmount Principal + interest (ceiling division enforced by caller)
    /// @param expiryAt   Unix timestamp after which claimDefault is allowed
    /// @param borrowerDest Where to send funds on commit
    /// @param hubLoc     XCM MultiLocation hash of Hub (for ACK callbacks)
    function prepare(
        uint256 loanId,
        uint256 principal,
        uint256 repayAmount,
        uint64  expiryAt,
        address borrowerDest,
        bytes32 hubLoc
    ) external;

    /// @notice Phase 2 of 2PC: disburse reserved funds to borrowerDest.
    ///         Idempotency: already Committed → no-op; state != Prepared → revert.
    function commit(uint256 loanId) external;

    /// @notice Cancel a prepared loan and return reserved funds to available.
    ///         Idempotency: already Aborted → no-op; state == Committed → revert (irreversible).
    function abort(uint256 loanId) external;

    // ─────────────────────────────────────────────────────────────────
    // Repay — open (borrower or Hub proxy)
    // ─────────────────────────────────────────────────────────────────

    /// @notice Repay committed loan. Must be in Committed state.
    ///         On repay: borrowed -= principal, available += repayAmount (interest retained).
    function repay(uint256 loanId, uint256 amount) external;

    // ─────────────────────────────────────────────────────────────────
    // Default Claim — permissionless
    // ─────────────────────────────────────────────────────────────────

    /// @notice Mark a Committed loan as DefaultClaimed after expiry.
    ///         Actual payout is sent by Hub directly from bond; this updates vault state only.
    ///         Reverts if block.timestamp < expiryAt or state != Committed.
    function claimDefault(uint256 loanId) external;

    // ─────────────────────────────────────────────────────────────────
    // Views
    // ─────────────────────────────────────────────────────────────────

    function getPool() external view returns (PoolState memory);
    function getVaultLoan(uint256 loanId) external view returns (VaultLoan memory);
    function sharesOf(address lp) external view returns (uint256);
}
