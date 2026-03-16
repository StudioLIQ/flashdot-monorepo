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

    error PoolInvariantBroken();
    error NotHubOrigin();
    error InvalidAsset();
    error InvalidHub();
    error ZeroAmount();
    error ZeroShares();
    error InsufficientShares();
    error InsufficientAvailable();
    error PrepareConflict();
    error PrepareInvalidState();
    error ZeroPrincipal();
    error RepayBelowPrincipal();
    error ExpiryInPast();
    error InvalidBorrowerDest();
    error InsufficientLiquidity();
    error NotPrepared();
    error CommitIsFinal();
    error NotCommitted();
    error InvalidRepayAmount();
    error NotExpired();

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
        if (pool.total != pool.available + pool.reserved + pool.borrowed) revert PoolInvariantBroken();
    }

    /// @dev Only Hub XCM sovereign account may call vault endpoints
    modifier onlyHubOrigin() {
        if (msg.sender != hubSovereignAccount) revert NotHubOrigin();
        _;
    }

    // ─────────────────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────────────────

    constructor(address _asset, address _hubSovereignAccount) {
        if (_asset == address(0)) revert InvalidAsset();
        if (_hubSovereignAccount == address(0)) revert InvalidHub();
        asset = IERC20(_asset);
        hubSovereignAccount = _hubSovereignAccount;
    }

    // ─────────────────────────────────────────────────────────────────
    // LP Management
    // ─────────────────────────────────────────────────────────────────

    /// @inheritdoc IFlashDotVault
    function deposit(uint256 amount) external nonReentrant poolInvariant returns (uint256 shares) {
        if (amount == 0) revert ZeroAmount();

        if (totalShares == 0 || pool.available == 0) {
            // First depositor: 1:1 share mint
            shares = amount;
        } else {
            // Pro-rata: shares = amount * totalShares / pool.available
            shares = (amount * totalShares) / pool.available;
            if (shares == 0) revert ZeroShares();
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
        if (shares == 0) revert ZeroShares();
        if (_lpShares[msg.sender] < shares) revert InsufficientShares();

        // amount = shares * pool.available / totalShares
        amount = (shares * pool.available) / totalShares;
        if (amount == 0) revert ZeroAmount();
        if (pool.available < amount) revert InsufficientAvailable();

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
            if (
                vl.principal != principal ||
                vl.repayAmount != repayAmount ||
                vl.expiryAt != expiryAt ||
                vl.borrowerDest != borrowerDest ||
                vl.hubLoc != hubLoc
            ) revert PrepareConflict();
            return;
        }

        if (exists && vl.state != VaultLoanState.Aborted) revert PrepareInvalidState();
        if (principal == 0) revert ZeroPrincipal();
        if (repayAmount < principal) revert RepayBelowPrincipal();
        if (expiryAt <= block.timestamp) revert ExpiryInPast();
        if (borrowerDest == address(0)) revert InvalidBorrowerDest();
        if (pool.available < principal) revert InsufficientLiquidity();

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

        if (vl.state != VaultLoanState.Prepared) revert NotPrepared();

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

        if (vl.state == VaultLoanState.Committed) revert CommitIsFinal();
        if (vl.state != VaultLoanState.Prepared) revert NotPrepared();

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
        if (vl.state != VaultLoanState.Committed) revert NotCommitted();
        if (amount == 0 || amount > vl.repayAmount) revert InvalidRepayAmount();

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
        if (block.timestamp < vl.expiryAt) revert NotExpired();
        if (vl.state != VaultLoanState.Committed) revert NotCommitted();

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
