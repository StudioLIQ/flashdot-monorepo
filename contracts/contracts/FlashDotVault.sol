// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IFlashDotVault} from "./interfaces/IFlashDotVault.sol";

/// @title FlashDotVault
/// @notice Cross-chain flash loan liquidity vault for FlashDot protocol.
///         Implements Two-Phase Commit (prepare → commit/abort) driven by Hub XCM.
/// @dev Pool invariant: pool.total == pool.available + pool.reserved + pool.borrowed
contract FlashDotVault is IFlashDotVault, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ─────────────────────────────────────────────────────────────────
    // State
    // ─────────────────────────────────────────────────────────────────

    IERC20 public immutable asset;

    /// @notice Hub XCM sovereign account — the only caller allowed on vault endpoints
    address public immutable hubSovereignAccount;

    PoolState public pool;

    /// @notice Per-loan vault state
    mapping(uint256 => VaultLoan) private _vaultLoans;

    /// @notice LP share balances
    mapping(address => uint256) private _lpShares;

    /// @notice Total LP shares issued
    uint256 public totalShares;

    // ─────────────────────────────────────────────────────────────────
    // Modifiers
    // ─────────────────────────────────────────────────────────────────

    /// @dev Enforce pool invariant after every state-changing function
    modifier poolInvariant() {
        _;
        require(
            pool.total == pool.available + pool.reserved + pool.borrowed,
            "POOL_INVARIANT"
        );
    }

    /// @dev Only Hub XCM sovereign account may call vault endpoints
    modifier onlyHubOrigin() {
        require(msg.sender == hubSovereignAccount, "UNAUTHORIZED: NOT_HUB_ORIGIN");
        _;
    }

    // ─────────────────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────────────────

    constructor(address _asset, address _hubSovereignAccount) {
        require(_asset != address(0), "INVALID_ASSET");
        require(_hubSovereignAccount != address(0), "INVALID_HUB");
        asset = IERC20(_asset);
        hubSovereignAccount = _hubSovereignAccount;
    }

    // ─────────────────────────────────────────────────────────────────
    // LP Management
    // ─────────────────────────────────────────────────────────────────

    /// @inheritdoc IFlashDotVault
    function deposit(uint256 amount) external nonReentrant poolInvariant returns (uint256 shares) {
        require(amount > 0, "ZERO_AMOUNT");

        if (totalShares == 0 || pool.available == 0) {
            // First depositor: 1:1 share mint
            shares = amount;
        } else {
            // Pro-rata: shares = amount * totalShares / pool.available
            shares = (amount * totalShares) / pool.available;
            require(shares > 0, "ZERO_SHARES");
        }

        pool.available += amount;
        pool.total += amount;
        _lpShares[msg.sender] += shares;
        totalShares += shares;

        asset.safeTransferFrom(msg.sender, address(this), amount);

        emit Deposited(msg.sender, amount, shares);
    }

    /// @inheritdoc IFlashDotVault
    function withdraw(uint256 shares) external nonReentrant poolInvariant returns (uint256 amount) {
        require(shares > 0, "ZERO_SHARES");
        require(_lpShares[msg.sender] >= shares, "INSUFFICIENT_SHARES");

        // amount = shares * pool.available / totalShares
        amount = (shares * pool.available) / totalShares;
        require(amount > 0, "ZERO_AMOUNT");
        require(pool.available >= amount, "INSUFFICIENT_AVAILABLE");

        _lpShares[msg.sender] -= shares;
        totalShares -= shares;
        pool.available -= amount;
        pool.total -= amount;

        asset.safeTransfer(msg.sender, amount);

        emit Withdrawn(msg.sender, shares, amount);
    }

    // ─────────────────────────────────────────────────────────────────
    // Vault Endpoints — onlyHubOrigin
    // ─────────────────────────────────────────────────────────────────

    /// @inheritdoc IFlashDotVault
    function prepare(
        uint256 loanId,
        uint256 principal,
        uint256 repayAmount,
        uint64  expiryAt,
        address borrowerDest,
        bytes32 hubLoc
    ) external onlyHubOrigin nonReentrant poolInvariant {
        VaultLoan storage vl = _vaultLoans[loanId];

        // Loan exists if principal > 0 (distinguishes from zero-initialized storage)
        bool exists = vl.principal > 0;

        if (exists && vl.state == VaultLoanState.Prepared) {
            // Idempotency: same params → no-op
            require(vl.principal == principal, "PREPARE_CONFLICT");
            require(vl.repayAmount == repayAmount, "PREPARE_CONFLICT");
            require(vl.expiryAt == expiryAt, "PREPARE_CONFLICT");
            require(vl.borrowerDest == borrowerDest, "PREPARE_CONFLICT");
            require(vl.hubLoc == hubLoc, "PREPARE_CONFLICT");
            return;
        }

        require(!exists || vl.state == VaultLoanState.Aborted, "PREPARE_INVALID_STATE");
        require(principal > 0, "ZERO_PRINCIPAL");
        require(repayAmount >= principal, "REPAY_BELOW_PRINCIPAL");
        require(expiryAt > block.timestamp, "EXPIRY_IN_PAST");
        require(borrowerDest != address(0), "INVALID_BORROWER_DEST");
        require(pool.available >= principal, "INSUFFICIENT_LIQUIDITY");

        pool.available -= principal;
        pool.reserved += principal;

        _vaultLoans[loanId] = VaultLoan({
            principal: principal,
            repayAmount: repayAmount,
            expiryAt: expiryAt,
            borrowerDest: borrowerDest,
            hubLoc: hubLoc,
            state: VaultLoanState.Prepared
        });

        emit LoanPrepared(loanId, principal, repayAmount, expiryAt);
    }

    /// @inheritdoc IFlashDotVault
    function commit(uint256 loanId) external onlyHubOrigin nonReentrant poolInvariant {
        VaultLoan storage vl = _vaultLoans[loanId];

        if (vl.state == VaultLoanState.Committed) {
            // Idempotency: already committed → no-op
            return;
        }

        require(vl.state == VaultLoanState.Prepared, "NOT_PREPARED");

        uint256 principal = vl.principal;
        address borrowerDest = vl.borrowerDest;

        pool.reserved -= principal;
        pool.borrowed += principal;
        vl.state = VaultLoanState.Committed;

        asset.safeTransfer(borrowerDest, principal);

        emit LoanCommitted(loanId, borrowerDest, principal);
    }

    /// @inheritdoc IFlashDotVault
    function abort(uint256 loanId) external onlyHubOrigin nonReentrant poolInvariant {
        VaultLoan storage vl = _vaultLoans[loanId];

        if (vl.state == VaultLoanState.Aborted) {
            // Idempotency: already aborted → no-op
            return;
        }

        require(vl.state != VaultLoanState.Committed, "COMMIT_IS_FINAL");
        require(vl.state == VaultLoanState.Prepared, "NOT_PREPARED");

        pool.reserved -= vl.principal;
        pool.available += vl.principal;
        vl.state = VaultLoanState.Aborted;

        emit LoanAborted(loanId);
    }

    // ─────────────────────────────────────────────────────────────────
    // Repay — open
    // ─────────────────────────────────────────────────────────────────

    /// @inheritdoc IFlashDotVault
    function repay(uint256 loanId, uint256 amount) external nonReentrant poolInvariant {
        VaultLoan storage vl = _vaultLoans[loanId];
        require(vl.state == VaultLoanState.Committed, "NOT_COMMITTED");
        require(amount > 0 && amount <= vl.repayAmount, "INVALID_REPAY_AMOUNT");

        uint256 principal = vl.principal;

        pool.borrowed -= principal;
        pool.available += amount; // amount >= principal (includes interest)
        pool.total += (amount - principal); // net interest income
        vl.state = VaultLoanState.Repaid;

        asset.safeTransferFrom(msg.sender, address(this), amount);

        emit LoanRepaid(loanId, amount);
    }

    // ─────────────────────────────────────────────────────────────────
    // Default Claim — permissionless
    // ─────────────────────────────────────────────────────────────────

    /// @inheritdoc IFlashDotVault
    function claimDefault(uint256 loanId) external nonReentrant poolInvariant {
        VaultLoan storage vl = _vaultLoans[loanId];
        require(block.timestamp >= vl.expiryAt, "NOT_EXPIRED");
        require(vl.state == VaultLoanState.Committed, "NOT_COMMITTED");

        uint256 principal = vl.principal;
        uint256 repayAmt = vl.repayAmount;

        // Hub sends bond payout directly; we adjust accounting here
        pool.borrowed -= principal;
        pool.available += repayAmt;
        pool.total += (repayAmt - principal); // bond payout covers interest too
        vl.state = VaultLoanState.DefaultClaimed;

        emit DefaultClaimed(loanId, repayAmt);
    }

    // ─────────────────────────────────────────────────────────────────
    // Views
    // ─────────────────────────────────────────────────────────────────

    function getPool() external view returns (PoolState memory) {
        return pool;
    }

    function getVaultLoan(uint256 loanId) external view returns (VaultLoan memory) {
        return _vaultLoans[loanId];
    }

    function sharesOf(address lp) external view returns (uint256) {
        return _lpShares[lp];
    }
}
