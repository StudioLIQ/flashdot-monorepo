// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {FlashDotHub} from "../../contracts/FlashDotHub.sol";
import {IFlashDotHub} from "../../contracts/interfaces/IFlashDotHub.sol";
import {ERC20Mock} from "./helpers/ERC20Mock.sol";
import {MockXcmPrecompile} from "../../contracts/mocks/MockXcmPrecompile.sol";

/// @title HubCreateTest
/// @notice Unit tests for FlashDotHub.createLoan() and cancelBeforeCommit()
contract HubCreateTest is Test {
    FlashDotHub public hub;
    ERC20Mock   public token;

    address public constant XCM_EXECUTOR = address(0xEEEE);
    address public constant FEE_RECIPIENT = address(0xFEE0);
    address public constant BORROWER     = address(0xB1);
    address public constant STRANGER     = address(0xDEAD);

    bytes32 public constant CHAIN_A = keccak256("chain-a");
    address public constant VAULT_A = address(0xA111);

    uint256 public constant PRINCIPAL   = 100_000 ether;
    uint256 public constant FEE_BUDGET  = 1 ether;
    uint32  public constant INTEREST    = 100; // 1%
    uint64  public constant DURATION    = 1 days;

    function setUp() public {
        token = new ERC20Mock("Mock DOT", "DOT", 18);
        MockXcmPrecompile _mock = new MockXcmPrecompile(address(0));
        hub = new FlashDotHub(XCM_EXECUTOR, FEE_RECIPIENT, address(_mock));
        vm.deal(address(hub), 100 ether);

        token.mint(BORROWER, 10_000_000 ether);
        vm.prank(BORROWER);
        token.approve(address(hub), type(uint256).max);
    }

    function _makeLoanParams() internal view returns (IFlashDotHub.LoanParams memory) {
        return IFlashDotHub.LoanParams({
            asset:        address(token),
            targetAmount: PRINCIPAL,
            interestBps:  INTEREST,
            expiryAt:     uint64(block.timestamp + DURATION)
        });
    }

    function _makeSingleLeg() internal pure returns (IFlashDotHub.LegSpec[] memory) {
        IFlashDotHub.LegSpec[] memory legs = new IFlashDotHub.LegSpec[](1);
        legs[0] = IFlashDotHub.LegSpec({
            chain:          CHAIN_A,
            vault:          VAULT_A,
            amount:         PRINCIPAL,
            feeBudget:      FEE_BUDGET,
            legInterestBps: INTEREST
        });
        return legs;
    }

    // ─────────────────────────────────────────────────────────────────
    // createLoan
    // ─────────────────────────────────────────────────────────────────

    function test_createLoan_happyPath() public {
        IFlashDotHub.LegSpec[] memory legs = _makeSingleLeg();
        // bond = ceil(100000e18 * 10100 / 10000) + 1e18 + HUB_FEE_BUFFER
        uint256 expectedBond = (PRINCIPAL * (10_000 + INTEREST) + 9_999) / 10_000 + FEE_BUDGET + hub.HUB_FEE_BUFFER();

        vm.prank(BORROWER);
        uint256 loanId = hub.createLoan(_makeLoanParams(), legs);

        assertEq(loanId, 1);

        IFlashDotHub.Loan memory loan = hub.getLoan(loanId);
        assertEq(loan.borrower, BORROWER);
        assertEq(uint8(loan.state), uint8(IFlashDotHub.LoanState.Created));
        assertEq(loan.targetAmount, PRINCIPAL);

        IFlashDotHub.BondInfo memory bond = hub.getBondInfo(loanId);
        assertEq(bond.bondAmount, expectedBond);

        // Bond transferred to hub
        assertEq(token.balanceOf(address(hub)), expectedBond);
    }

    function test_createLoan_bondCeilingDivision() public {
        // Use odd bps to force ceiling rounding
        IFlashDotHub.LegSpec[] memory legs = new IFlashDotHub.LegSpec[](1);
        legs[0] = IFlashDotHub.LegSpec({
            chain:          CHAIN_A,
            vault:          VAULT_A,
            amount:         1 ether,    // 1 DOT
            feeBudget:      0,
            legInterestBps: 1           // 0.01% bps
        });
        // repayAmt = ceil(1e18 * 10001 / 10000) = ceil(1.0001e18) = 1000100000000000 + 1 (if not exact)
        // (1e18 * 10001 + 9999) / 10000 = (10001e18 + 9999) / 10000
        uint256 amt = 1 ether;
        uint256 expected = (amt * 10_001 + 9_999) / 10_000 + hub.HUB_FEE_BUFFER();

        vm.prank(BORROWER);
        uint256 loanId = hub.createLoan(_makeLoanParams(), legs);

        IFlashDotHub.BondInfo memory bond = hub.getBondInfo(loanId);
        assertEq(bond.bondAmount, expected, "bond must use ceiling division");
    }

    function test_createLoan_insufficientBond_reverts() public {
        // This tests that if borrower tries to create with insufficient balance (no approval),
        // it reverts via ERC20 transferFrom
        IFlashDotHub.LegSpec[] memory legs = _makeSingleLeg();

        address poorBorrower = address(0xC001);
        token.mint(poorBorrower, 1); // only 1 wei
        vm.prank(poorBorrower);
        token.approve(address(hub), 1);

        vm.prank(poorBorrower);
        vm.expectRevert(); // ERC20 transfer failure
        hub.createLoan(_makeLoanParams(), legs);
    }

    function test_createLoan_expiryTooSoon_reverts() public {
        IFlashDotHub.LegSpec[] memory legs = _makeSingleLeg();
        IFlashDotHub.LoanParams memory params = _makeLoanParams();
        params.expiryAt = uint64(block.timestamp + 1); // too soon

        vm.prank(BORROWER);
        vm.expectRevert("EXPIRY_TOO_SOON");
        hub.createLoan(params, legs);
    }

    function test_createLoan_noLegs_reverts() public {
        IFlashDotHub.LegSpec[] memory emptyLegs = new IFlashDotHub.LegSpec[](0);
        vm.prank(BORROWER);
        vm.expectRevert("NO_LEGS");
        hub.createLoan(_makeLoanParams(), emptyLegs);
    }

    function test_createLoan_paused_reverts() public {
        hub.pauseCreate(true);
        vm.prank(BORROWER);
        vm.expectRevert("CREATE_PAUSED");
        hub.createLoan(_makeLoanParams(), _makeSingleLeg());
    }

    function test_createLoan_multiLeg() public {
        IFlashDotHub.LegSpec[] memory legs = new IFlashDotHub.LegSpec[](2);
        legs[0] = IFlashDotHub.LegSpec({
            chain: CHAIN_A, vault: VAULT_A, amount: 50_000 ether,
            feeBudget: FEE_BUDGET, legInterestBps: INTEREST
        });
        legs[1] = IFlashDotHub.LegSpec({
            chain: keccak256("chain-b"), vault: address(0xB111), amount: 50_000 ether,
            feeBudget: FEE_BUDGET, legInterestBps: INTEREST
        });

        vm.prank(BORROWER);
        uint256 loanId = hub.createLoan(_makeLoanParams(), legs);

        assertEq(hub.getLegCount(loanId), 2);
        assertEq(hub.getLeg(loanId, 0).vault, VAULT_A);
    }

    // ─────────────────────────────────────────────────────────────────
    // cancelBeforeCommit
    // ─────────────────────────────────────────────────────────────────

    function test_cancel_inCreatedState_returnsBond() public {
        IFlashDotHub.LegSpec[] memory legs = _makeSingleLeg();
        vm.prank(BORROWER);
        uint256 loanId = hub.createLoan(_makeLoanParams(), legs);

        uint256 borrowerBalBefore = token.balanceOf(BORROWER);
        uint256 bondAmount = hub.getBondInfo(loanId).bondAmount;

        vm.prank(BORROWER);
        hub.cancelBeforeCommit(loanId);

        IFlashDotHub.Loan memory loan = hub.getLoan(loanId);
        assertEq(uint8(loan.state), uint8(IFlashDotHub.LoanState.Aborted));
        assertEq(token.balanceOf(BORROWER) - borrowerBalBefore, bondAmount, "bond returned");
    }

    function test_cancel_strangerCannotCancel_reverts() public {
        vm.prank(BORROWER);
        uint256 loanId = hub.createLoan(_makeLoanParams(), _makeSingleLeg());

        vm.prank(STRANGER);
        vm.expectRevert("NOT_BORROWER");
        hub.cancelBeforeCommit(loanId);
    }

    // ─────────────────────────────────────────────────────────────────
    // Fuzz: bond calculation
    // ─────────────────────────────────────────────────────────────────

    function testFuzz_bondCalculation(uint96 principal, uint16 bps, uint64 feeBudget) public {
        vm.assume(principal > 0 && principal <= 1_000_000 ether);
        vm.assume(bps <= 1000); // max 10%
        vm.assume(feeBudget <= 10 ether);

        IFlashDotHub.LegSpec[] memory legs = new IFlashDotHub.LegSpec[](1);
        legs[0] = IFlashDotHub.LegSpec({
            chain:          CHAIN_A,
            vault:          VAULT_A,
            amount:         principal,
            feeBudget:      feeBudget,
            legInterestBps: bps
        });

        uint256 expectedBond = (uint256(principal) * (10_000 + bps) + 9_999) / 10_000
                             + feeBudget
                             + hub.HUB_FEE_BUFFER();

        // Verify the Hub's internal calc matches
        // We check by creating a loan and reading back the bondAmount
        token.mint(BORROWER, expectedBond * 2);
        vm.prank(BORROWER);
        token.approve(address(hub), type(uint256).max);

        IFlashDotHub.LoanParams memory params = IFlashDotHub.LoanParams({
            asset:        address(token),
            targetAmount: principal,
            interestBps:  bps,
            expiryAt:     uint64(block.timestamp + DURATION)
        });

        vm.prank(BORROWER);
        uint256 loanId = hub.createLoan(params, legs);

        assertEq(hub.getBondInfo(loanId).bondAmount, expectedBond, "bond mismatch");
    }
}
