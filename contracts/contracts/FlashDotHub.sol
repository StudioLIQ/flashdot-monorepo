// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IFlashDotHub} from "./interfaces/IFlashDotHub.sol";
import {IXcmPrecompile, XCM_PRECOMPILE_ADDRESS} from "./interfaces/IXcmPrecompile.sol";
import {XcmEncoder} from "./lib/XcmEncoder.sol";

/// @title FlashDotHub
/// @notice Cross-chain flash loan coordinator on Polkadot Hub EVM.
///         Implements Two-Phase Commit (2PC) via XCM precompile.
///
/// Key invariants:
///   I-1: committed lender receives principal + interest (repay or bond slash)
///   I-2: CommittedAcked leg → no transition back
///   I-3: all vault endpoint calls are idempotent
///   I-4: bond ≥ Σ(repay_i) + Σ(feeBudget_i) + HUB_FEE_BUFFER
///   I-5: only Hub XCM sovereign origin can call vault endpoints
///   I-6: disbursement per loanId is single-execution
contract FlashDotHub is IFlashDotHub, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    error NotXcmExecutor();
    error CreatePaused();
    error CommitPaused();
    error InvalidXcmExecutor();
    error InvalidFeeRecipient();
    error InvalidAsset();
    error NoLegs();
    error ExpiryTooSoon();
    error TooLateToCancel();
    error NotAuthorizedToCancel();
    error NotCreated();
    error UnknownQuery();
    error NotPrepared();
    error NotCommitting();
    error AlreadyRepayOnly();
    error CommitNotStarted();
    error CommitTimeoutNotReached();
    error CannotSettle();
    error LegsNotFullyRepaid();
    error NotExpired();
    error AlreadyDefaulted();
    error NotDefaultable();
    error BondInsufficient();
    error InvalidRecipient();

    // ─────────────────────────────────────────────────────────────────
    // Constants
    // ─────────────────────────────────────────────────────────────────

    uint256 public constant HUB_FEE_BPS      = 10;          // 0.1% hub fee on settle
    uint256 public constant HUB_FEE_BUFFER   = 0.01 ether;  // extra bond buffer for hub ops
    uint64  public constant MIN_LOAN_DURATION = 300;         // 5 minutes minimum
    uint64  public constant COMMIT_TIMEOUT    = 120;         // 2 minutes

    // XCM executor: the address that delivers XCM callbacks on Polkadot Hub
    // In production: the Hub's XCM executor account (sovereign or precompile)
    // In tests: set via constructor
    address public immutable XCM_EXECUTOR;

    IXcmPrecompile public immutable xcmPrecompile;

    // ─────────────────────────────────────────────────────────────────
    // Storage
    // ─────────────────────────────────────────────────────────────────

    uint256 public nextLoanId;

    mapping(uint256 => Loan) private _loans;
    mapping(uint256 => mapping(uint256 => Leg)) private _legs;
    mapping(uint256 => uint256) private _legCount;
    mapping(uint256 => BondInfo) private _bondEscrow;
    mapping(bytes32 => QueryMeta) private _queryIndex;

    mapping(uint256 => uint64) private _prepareStartedAt;
    mapping(uint256 => uint64) private _commitStartedAt;

    bool public createPaused;
    bool public commitPaused;
    mapping(bytes32 => bool) public supportedChains;

    address public feeRecipient;

    // ─────────────────────────────────────────────────────────────────
    // Internal types
    // ─────────────────────────────────────────────────────────────────

    struct QueryMeta {
        uint256 loanId;
        uint256 legId;
        Phase   phase;
        bool    exists;
    }

    enum Phase { Prepare, Commit }

    // ─────────────────────────────────────────────────────────────────
    // Modifiers
    // ─────────────────────────────────────────────────────────────────

    modifier onlyXcmExecutor() {
        if (msg.sender != XCM_EXECUTOR) revert NotXcmExecutor();
        _;
    }

    modifier whenCreateNotPaused() {
        if (createPaused) revert CreatePaused();
        _;
    }

    modifier whenCommitNotPaused() {
        if (commitPaused) revert CommitPaused();
        _;
    }

    // ─────────────────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────────────────

    constructor(
        address _xcmExecutor,
        address _feeRecipient,
        address _xcmPrecompile
    ) Ownable(msg.sender) {
        if (_xcmExecutor == address(0)) revert InvalidXcmExecutor();
        if (_feeRecipient == address(0)) revert InvalidFeeRecipient();
        XCM_EXECUTOR = _xcmExecutor;
        // Use provided precompile address (defaults to production address in prod deploy)
        xcmPrecompile = IXcmPrecompile(_xcmPrecompile != address(0) ? _xcmPrecompile : XCM_PRECOMPILE_ADDRESS);
        feeRecipient = _feeRecipient;
        nextLoanId = 1;
    }

    // ─────────────────────────────────────────────────────────────────
    // T-10: createLoan + cancelBeforeCommit
    // ─────────────────────────────────────────────────────────────────

    /// @inheritdoc IFlashDotHub
    function createLoan(
        LoanParams calldata params,
        LegSpec[] calldata legSpecs
    ) external whenCreateNotPaused returns (uint256 loanId) {
        // --- Validate params ---
        if (params.asset == address(0)) revert InvalidAsset();
        if (legSpecs.length == 0) revert NoLegs();
        if (params.expiryAt <= block.timestamp + MIN_LOAN_DURATION) revert ExpiryTooSoon();

        // --- Compute bond required (I-4) ---
        uint256 bondRequired = _calcBondRequired(legSpecs);

        // --- Transfer bond from borrower ---
        loanId = nextLoanId++;

        IERC20(params.asset).safeTransferFrom(msg.sender, address(this), bondRequired);

        // --- Initialize loan ---
        _loans[loanId] = Loan({
            borrower:      msg.sender,
            asset:         params.asset,
            targetAmount:  params.targetAmount,
            interestBps:   params.interestBps,
            createdAt:     uint64(block.timestamp),
            expiryAt:      params.expiryAt,
            state:         LoanState.Created,
            repayOnlyMode: false,
            planHash:      keccak256(abi.encode(legSpecs))
        });

        // --- Initialize legs ---
        uint256 nLegs = legSpecs.length;
        _legCount[loanId] = nLegs;
        for (uint256 i = 0; i < nLegs; ) {
            _legs[loanId][i] = Leg({
                chain:          legSpecs[i].chain,
                vault:          legSpecs[i].vault,
                amount:         legSpecs[i].amount,
                feeBudget:      legSpecs[i].feeBudget,
                legInterestBps: legSpecs[i].legInterestBps,
                state:          LegState.Init
            });
            unchecked { ++i; }
        }

        // --- Initialize bond escrow ---
        _bondEscrow[loanId] = BondInfo({
            bondAmount: bondRequired,
            lockedAt:   uint64(block.timestamp),
            slashed:    false
        });

        emit LoanCreated(loanId, msg.sender, params.asset, params.targetAmount, bondRequired);
    }

    /// @inheritdoc IFlashDotHub
    function cancelBeforeCommit(uint256 loanId) external {
        Loan storage loan = _loans[loanId];
        if (
            loan.state != LoanState.Created &&
            loan.state != LoanState.Preparing &&
            loan.state != LoanState.Prepared
        ) revert TooLateToCancel();

        bool borrowerRequested = loan.borrower == msg.sender;
        bool timedOutPrepare = _prepareStartedAt[loanId] != 0
            && (
                loan.state == LoanState.Preparing ||
                loan.state == LoanState.Prepared
            )
            && block.timestamp >= _prepareStartedAt[loanId] + COMMIT_TIMEOUT;
        if (!borrowerRequested && !timedOutPrepare) revert NotAuthorizedToCancel();

        uint256 nLegs = _legCount[loanId];
        for (uint256 i = 0; i < nLegs; ) {
            Leg storage leg = _legs[loanId][i];
            if (
                leg.state == LegState.PrepareSent ||
                leg.state == LegState.PreparedAcked
            ) {
                // Send XCM abort stub (actual XCM in M3)
                _sendXcmAbortStub(loanId, i, leg);
                leg.state = LegState.Aborted;
            }
            unchecked { ++i; }
        }

        loan.state = LoanState.Aborted;
        _prepareStartedAt[loanId] = 0;
        _commitStartedAt[loanId] = 0;

        // Return bond to borrower
        IERC20(loan.asset).safeTransfer(loan.borrower, _bondEscrow[loanId].bondAmount);

        emit LoanAborted(loanId, borrowerRequested ? "cancelled by borrower" : "cancelled after prepare timeout");
    }

    // ─────────────────────────────────────────────────────────────────
    // T-11: startPrepare + onXcmAck (Prepare phase)
    // ─────────────────────────────────────────────────────────────────

    /// @inheritdoc IFlashDotHub
    function startPrepare(uint256 loanId) external {
        Loan storage loan = _loans[loanId];
        if (loan.state != LoanState.Created) revert NotCreated();

        loan.state = LoanState.Preparing;
        _prepareStartedAt[loanId] = uint64(block.timestamp);

        uint256 nLegs = _legCount[loanId];
        for (uint256 i = 0; i < nLegs; ) {
            Leg storage leg = _legs[loanId][i];

            bytes32 queryId = _makeQueryId(loanId, i, Phase.Prepare);
            _queryIndex[queryId] = QueryMeta({
                loanId: loanId,
                legId:  i,
                phase:  Phase.Prepare,
                exists: true
            });

            leg.state = LegState.PrepareSent;

            // XCM Transact stub (actual call wired in M3)
            _sendXcmPrepareStub(loanId, i, leg, queryId);

            emit PrepareSent(loanId, i, leg.chain, leg.amount);
            unchecked { ++i; }
        }
    }

    /// @inheritdoc IFlashDotHub
    function onXcmAck(bytes32 queryId, bool success) external onlyXcmExecutor {
        QueryMeta storage meta = _queryIndex[queryId];
        if (!meta.exists) revert UnknownQuery();

        uint256 loanId = meta.loanId;
        uint256 legId  = meta.legId;
        Phase   phase  = meta.phase;

        // Mark query as consumed (idempotency: second call does nothing)
        meta.exists = false;

        Loan storage loan = _loans[loanId];
        Leg  storage leg  = _legs[loanId][legId];

        if (phase == Phase.Prepare) {
            _handlePrepareAck(loanId, legId, loan, leg, success);
        } else {
            _handleCommitAck(loanId, legId, loan, leg, success);
        }
    }

    function _handlePrepareAck(
        uint256 loanId,
        uint256 legId,
        Loan storage loan,
        Leg  storage leg,
        bool success
    ) internal {
        if (!success) {
            // Prepare failed → abort entire loan
            leg.state = LegState.Aborted;
            _abortAllPreparedLegs(loanId, loan);
            loan.state = LoanState.Aborted;
            IERC20(loan.asset).safeTransfer(loan.borrower, _bondEscrow[loanId].bondAmount);
            emit LoanAborted(loanId, "prepare failed on leg");
            return;
        }

        // Guard: only advance if we're still in Preparing (not already aborted)
        if (loan.state != LoanState.Preparing) return;

        leg.state = LegState.PreparedAcked;
        emit PreparedAcked(loanId, legId, leg.chain);

        // Check if all legs are PreparedAcked
        if (_allLegsIn(loanId, LegState.PreparedAcked)) {
            loan.state = LoanState.Prepared;
        }
    }

    function _abortAllPreparedLegs(uint256 loanId, Loan storage loan) internal {
        uint256 nLegs = _legCount[loanId];
        for (uint256 i = 0; i < nLegs; ) {
            Leg storage l = _legs[loanId][i];
            if (l.state == LegState.PrepareSent || l.state == LegState.PreparedAcked) {
                _sendXcmAbortStub(loanId, i, l);
                l.state = LegState.Aborted;
            }
            unchecked { ++i; }
        }
        // Suppress unused variable warning
        loan;
    }

    // ─────────────────────────────────────────────────────────────────
    // T-12: startCommit + onXcmAck (Commit phase) + RepayOnlyMode
    // ─────────────────────────────────────────────────────────────────

    /// @inheritdoc IFlashDotHub
    function startCommit(uint256 loanId) external whenCommitNotPaused {
        Loan storage loan = _loans[loanId];
        if (loan.state != LoanState.Prepared) revert NotPrepared();

        loan.state = LoanState.Committing;
        _commitStartedAt[loanId] = uint64(block.timestamp);

        uint256 nLegs = _legCount[loanId];
        for (uint256 i = 0; i < nLegs; ) {
            Leg storage leg = _legs[loanId][i];
            if (leg.state == LegState.PreparedAcked) {
                bytes32 queryId = _makeQueryId(loanId, i, Phase.Commit);
                _queryIndex[queryId] = QueryMeta({
                    loanId: loanId,
                    legId:  i,
                    phase:  Phase.Commit,
                    exists: true
                });
                leg.state = LegState.CommitSent;
                _sendXcmCommitStub(loanId, i, leg, queryId);
                emit CommitSent(loanId, i, leg.chain, leg.amount);
            }
            unchecked { ++i; }
        }
    }

    /// @inheritdoc IFlashDotHub
    function enforceCommitTimeout(uint256 loanId) external {
        Loan storage loan = _loans[loanId];
        if (loan.state != LoanState.Committing) revert NotCommitting();
        if (loan.repayOnlyMode) revert AlreadyRepayOnly();
        if (_commitStartedAt[loanId] == 0) revert CommitNotStarted();
        if (block.timestamp < _commitStartedAt[loanId] + COMMIT_TIMEOUT) revert CommitTimeoutNotReached();

        loan.repayOnlyMode = true;
        _abortPreparedOnlyLegs(loanId);
        emit RepayOnlyMode(loanId, "commit timeout");
    }

    function _handleCommitAck(
        uint256 loanId,
        uint256 legId,
        Loan storage loan,
        Leg  storage leg,
        bool success
    ) internal {
        if (!success) {
            // Commit failure → RepayOnlyMode (I-2: CommittedAcked legs must NOT be aborted)
            if (!loan.repayOnlyMode) {
                loan.repayOnlyMode = true;
                emit RepayOnlyMode(loanId, "commit ack failed");
                // Abort remaining non-committed legs
                _abortNonCommittedLegs(loanId);
            }
            leg.state = LegState.Aborted;
            return;
        }

        // I-2: once CommittedAcked, never go back
        leg.state = LegState.CommittedAcked;
        emit CommittedAcked(loanId, legId, leg.chain);

        // Check if all commit-sent legs are now CommittedAcked
        if (_allCommittedLegsAcked(loanId)) {
            loan.state = LoanState.Committed;
        }
    }

    function _abortNonCommittedLegs(uint256 loanId) internal {
        uint256 nLegs = _legCount[loanId];
        for (uint256 i = 0; i < nLegs; ) {
            Leg storage l = _legs[loanId][i];
            if (l.state == LegState.PreparedAcked || l.state == LegState.CommitSent) {
                _sendXcmAbortStub(loanId, i, l);
                l.state = LegState.Aborted;
            }
            unchecked { ++i; }
        }
    }

    function _abortPreparedOnlyLegs(uint256 loanId) internal {
        uint256 nLegs = _legCount[loanId];
        for (uint256 i = 0; i < nLegs; ) {
            Leg storage l = _legs[loanId][i];
            if (l.state == LegState.PreparedAcked) {
                _sendXcmAbortStub(loanId, i, l);
                l.state = LegState.Aborted;
            }
            unchecked { ++i; }
        }
    }

    // ─────────────────────────────────────────────────────────────────
    // T-13: finalizeSettle + triggerDefault + governance
    // ─────────────────────────────────────────────────────────────────

    /// @inheritdoc IFlashDotHub
    function finalizeSettle(uint256 loanId) external nonReentrant {
        Loan storage loan = _loans[loanId];
        if (loan.state != LoanState.Committed && loan.state != LoanState.Repaying) revert CannotSettle();

        // All CommittedAcked legs must be RepaidConfirmed
        if (!_allCommittedLegsRepaid(loanId)) revert LegsNotFullyRepaid();

        // Hub fee: ceiling division
        uint256 hubFee = (loan.targetAmount * HUB_FEE_BPS + 9_999) / 10_000;
        uint256 bondReturn = _bondEscrow[loanId].bondAmount - hubFee;

        loan.state = LoanState.Settled;

        IERC20(loan.asset).safeTransfer(feeRecipient, hubFee);
        IERC20(loan.asset).safeTransfer(loan.borrower, bondReturn);

        emit LoanSettled(loanId, hubFee);
    }

    /// @inheritdoc IFlashDotHub
    function triggerDefault(uint256 loanId) external nonReentrant {
        Loan storage loan = _loans[loanId];
        if (block.timestamp < loan.expiryAt) revert NotExpired();

        BondInfo storage bond = _bondEscrow[loanId];
        // Check already defaulted before state check (state becomes Defaulted after first trigger)
        if (bond.slashed) revert AlreadyDefaulted();
        if (loan.state != LoanState.Committed && !loan.repayOnlyMode) revert NotDefaultable();

        uint256 totalPayout = 0;
        uint256 nLegs = _legCount[loanId];

        // Pay each committed leg from bond (I-1)
        for (uint256 i = 0; i < nLegs; ) {
            Leg storage leg = _legs[loanId][i];
            if (leg.state == LegState.CommittedAcked) {
                // repayAmount = ceil(amount * (10000 + bps) / 10000)
                uint256 bps = leg.legInterestBps > 0 ? leg.legInterestBps : loan.interestBps;
                uint256 repayAmt = (leg.amount * (10_000 + bps) + 9_999) / 10_000;
                totalPayout += repayAmt;

                // Direct transfer to vault (vault claimDefault must already be called)
                IERC20(loan.asset).safeTransfer(leg.vault, repayAmt);
                leg.state = LegState.DefaultPaid;
            }
            unchecked { ++i; }
        }

        // Assert bond covers payout (I-4 guarantees this; belt-and-suspenders check)
        if (bond.bondAmount < totalPayout) revert BondInsufficient();

        uint256 remainder = bond.bondAmount - totalPayout;
        bond.slashed = true;
        loan.state = LoanState.Defaulted;

        if (remainder > 0) {
            IERC20(loan.asset).safeTransfer(loan.borrower, remainder);
        }

        emit LoanDefaulted(loanId, totalPayout);
    }

    // ─────────────────────────────────────────────────────────────────
    // Governance
    // ─────────────────────────────────────────────────────────────────

    function pauseCreate(bool paused) external onlyOwner {
        createPaused = paused;
    }

    function pauseCommit(bool paused) external onlyOwner {
        commitPaused = paused;
    }

    function setSupportedChains(bytes32[] calldata chains) external onlyOwner {
        for (uint256 i = 0; i < chains.length; ) {
            supportedChains[chains[i]] = true;
            unchecked { ++i; }
        }
    }

    function setFeeRecipient(address recipient) external onlyOwner {
        if (recipient == address(0)) revert InvalidRecipient();
        feeRecipient = recipient;
    }

    /// @notice Accept native token (for XCM fee funding)
    receive() external payable {}

    // ─────────────────────────────────────────────────────────────────
    // Views
    // ─────────────────────────────────────────────────────────────────

    function getLoan(uint256 loanId) external view returns (Loan memory) {
        return _loans[loanId];
    }

    function getLeg(uint256 loanId, uint256 legId) external view returns (Leg memory) {
        return _legs[loanId][legId];
    }

    function getBondInfo(uint256 loanId) external view returns (BondInfo memory) {
        return _bondEscrow[loanId];
    }

    function getLegCount(uint256 loanId) external view returns (uint256) {
        return _legCount[loanId];
    }

    // ─────────────────────────────────────────────────────────────────
    // Internal helpers
    // ─────────────────────────────────────────────────────────────────

    /// @notice Compute required bond using ceiling division (lender-favoring)
    /// bond = Σ ceil(amount_i × (10000 + bps_i) / 10000) + Σ feeBudget_i + HUB_FEE_BUFFER
    function _calcBondRequired(LegSpec[] calldata legs) internal pure returns (uint256 bond) {
        for (uint256 i = 0; i < legs.length; ) {
            uint256 bps = legs[i].legInterestBps;
            // Ceiling division: (a * b + c - 1) / c
            bond += (legs[i].amount * (10_000 + bps) + 9_999) / 10_000;
            bond += legs[i].feeBudget;
            unchecked { ++i; }
        }
        bond += HUB_FEE_BUFFER;
    }

    function _makeQueryId(uint256 loanId, uint256 legId, Phase phase) internal view returns (bytes32) {
        return keccak256(abi.encodePacked(loanId, legId, uint8(phase), block.timestamp));
    }

    function _allLegsIn(uint256 loanId, LegState target) internal view returns (bool) {
        uint256 nLegs = _legCount[loanId];
        for (uint256 i = 0; i < nLegs; ) {
            if (_legs[loanId][i].state != target) return false;
            unchecked { ++i; }
        }
        return true;
    }

    function _allCommittedLegsAcked(uint256 loanId) internal view returns (bool) {
        uint256 nLegs = _legCount[loanId];
        for (uint256 i = 0; i < nLegs; ) {
            LegState s = _legs[loanId][i].state;
            if (s == LegState.CommitSent) return false;
            unchecked { ++i; }
        }
        return true;
    }

    function _allCommittedLegsRepaid(uint256 loanId) internal view returns (bool) {
        uint256 nLegs = _legCount[loanId];
        for (uint256 i = 0; i < nLegs; ) {
            LegState s = _legs[loanId][i].state;
            if (s == LegState.CommittedAcked) return false; // not yet repaid
            unchecked { ++i; }
        }
        return true;
    }

    // ─────────────────────────────────────────────────────────────────
    // XCM Send (wired via IXcmPrecompile — uses MockXcmPrecompile in tests)
    // ─────────────────────────────────────────────────────────────────

    uint64 public constant XCM_WEIGHT_PREPARE = 2_000_000_000;
    uint64 public constant XCM_WEIGHT_COMMIT  = 2_000_000_000;
    uint64 public constant XCM_WEIGHT_ABORT   = 1_000_000_000;

    function _sendXcmPrepareStub(
        uint256 loanId,
        uint256 legId,
        Leg storage leg,
        bytes32 queryId
    ) internal {
        Loan storage loan = _loans[loanId];
        uint256 repayAmt = (leg.amount * (10_000 + leg.legInterestBps) + 9_999) / 10_000;

        bytes memory destEncoded  = XcmEncoder.encodeParachainLocation(uint32(uint256(leg.chain)));
        bytes memory callEncoded  = XcmEncoder.encodePrepareCall(
            leg.vault, loanId, leg.amount, repayAmt,
            loan.expiryAt, loan.borrower, bytes32(uint256(uint160(address(this))))
        );
        bytes memory callbackDest = XcmEncoder.encodeHubLocation();

        // feeBudget pays for XCM delivery; hub must hold enough ETH for this
        // In production, borrower deposits feeBudget as native token alongside bond
        xcmPrecompile.xcmTransact{value: leg.feeBudget}(
            destEncoded, callEncoded, XCM_WEIGHT_PREPARE, queryId, callbackDest
        );

        emit XcmPrepareSent(loanId, legId, leg.chain, leg.vault, queryId);
    }

    function _sendXcmCommitStub(
        uint256 loanId,
        uint256 legId,
        Leg storage leg,
        bytes32 queryId
    ) internal {
        bytes memory destEncoded  = XcmEncoder.encodeParachainLocation(uint32(uint256(leg.chain)));
        bytes memory callEncoded  = XcmEncoder.encodeCommitCall(loanId);
        bytes memory callbackDest = XcmEncoder.encodeHubLocation();

        xcmPrecompile.xcmTransact{value: leg.feeBudget}(
            destEncoded, callEncoded, XCM_WEIGHT_COMMIT, queryId, callbackDest
        );

        emit XcmCommitSent(loanId, legId, leg.chain, leg.vault, queryId);
    }

    function _sendXcmAbortStub(uint256 loanId, uint256 legId, Leg storage leg) internal {
        bytes32 queryId   = _makeQueryId(loanId, legId, Phase.Prepare); // abort has no ACK needed
        bytes memory destEncoded  = XcmEncoder.encodeParachainLocation(uint32(uint256(leg.chain)));
        bytes memory callEncoded  = XcmEncoder.encodeAbortCall(loanId);
        bytes memory callbackDest = XcmEncoder.encodeHubLocation();

        // Abort is fire-and-forget; we don't need an ACK
        xcmPrecompile.xcmTransact{value: 0}(
            destEncoded, callEncoded, XCM_WEIGHT_ABORT, queryId, callbackDest
        );

        emit XcmAbortSent(loanId, legId, leg.chain, leg.vault);
    }

    // Internal events for XCM tracking
    event XcmPrepareSent(uint256 indexed loanId, uint256 legId, bytes32 chain, address vault, bytes32 queryId);
    event XcmCommitSent(uint256 indexed loanId, uint256 legId, bytes32 chain, address vault, bytes32 queryId);
    event XcmAbortSent(uint256 indexed loanId, uint256 legId, bytes32 chain, address vault);

    // ─────────────────────────────────────────────────────────────────
    // External helpers for tests (expose queryId for ACK simulation)
    // ─────────────────────────────────────────────────────────────────

    /// @notice Helper for tests: given loan/leg/phase, compute the queryId
    ///         NOTE: depends on block.timestamp at time of startPrepare/startCommit
    function getQueryId(uint256 loanId, uint256 legId, bool isCommit, uint256 timestamp)
        external
        pure
        returns (bytes32)
    {
        return keccak256(abi.encodePacked(loanId, legId, uint8(isCommit ? 1 : 0), timestamp));
    }
}
