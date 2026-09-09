// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title TokenVaultV1
 * @notice Production-grade upgradeable token vault implementing the UUPS proxy pattern.
 * @dev Manages ERC20 deposits and withdrawals with a configurable deposit fee and role-based access control.
 */
contract TokenVaultV1 is Initializable, UUPSUpgradeable, AccessControlUpgradeable {
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    IERC20 internal token;
    uint256 internal depositFee; // fee in basis points (e.g., 500 = 5%)
    uint256 internal _totalDeposits;
    mapping(address => uint256) internal balances;

    /* ========== EVENTS ========== */
    event Deposit(address indexed user, uint256 amount, uint256 fee);
    event Withdraw(address indexed user, uint256 amount);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initializes the TokenVaultV1 contract.
     * @dev Replaces constructor for upgradeable proxies.
     * @param _token The underlying ERC20 token accepted by the vault.
     * @param _admin The account granted DEFAULT_ADMIN_ROLE, UPGRADER_ROLE, and PAUSER_ROLE.
     * @param _depositFee The initial deposit fee in basis points (10000 = 100%).
     */
    function initialize(
        address _token,
        address _admin,
        uint256 _depositFee
    ) external initializer {
        require(_token != address(0), "Invalid token address");
        require(_admin != address(0), "Invalid admin address");
        require(_depositFee <= 10000, "Fee exceeds 100%");

        __AccessControl_init();
        __UUPSUpgradeable_init();

        token = IERC20(_token);
        depositFee = _depositFee;

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(UPGRADER_ROLE, _admin);
        _grantRole(PAUSER_ROLE, _admin);
    }

    /**
     * @notice Authorizes upgrades to new logic implementations.
     * @dev Required by OpenZeppelin UUPSUpgradeable; restricted to UPGRADER_ROLE.
     * @param newImplementation Address of the new contract implementation.
     */
    function _authorizeUpgrade(address newImplementation)
        internal
        override
        onlyRole(UPGRADER_ROLE)
    {}

    /**
     * @notice Deposits ERC20 tokens into the vault, deducting the deposit fee.
     * @param amount The amount of tokens to deposit.
     */
    function deposit(uint256 amount) public virtual {
        require(amount > 0, "Amount must be > 0");

        uint256 fee = (amount * depositFee) / 10000;
        uint256 credited = amount - fee;

        balances[msg.sender] += credited;
        _totalDeposits += credited;

        emit Deposit(msg.sender, credited, fee);

        token.transferFrom(msg.sender, address(this), amount);
    }

    /**
     * @notice Withdraws deposited tokens from the vault.
     * @param amount The amount of tokens to withdraw.
     */
    function withdraw(uint256 amount) external {
        require(amount > 0, "Amount must be > 0");
        require(balances[msg.sender] >= amount, "Insufficient balance");

        balances[msg.sender] -= amount;
        _totalDeposits -= amount;

        emit Withdraw(msg.sender, amount);

        token.transfer(msg.sender, amount);
    }

    /**
     * @notice Returns the deposited balance of a user.
     * @param user The address of the account to query.
     * @return The net balance credited to the user.
     */
    function balanceOf(address user) external view returns (uint256) {
        return balances[user];
    }

    /**
     * @notice Returns the total deposits held in the vault across all users.
     * @return The sum of credited user balances.
     */
    function totalDeposits() external view returns (uint256) {
        return _totalDeposits;
    }

    /**
     * @notice Returns the vault deposit fee in basis points.
     * @return The deposit fee (e.g., 500 = 5%).
     */
    function getDepositFee() external view returns (uint256) {
        return depositFee;
    }

    /**
     * @notice Returns the implementation version string.
     * @return The version string "V1".
     */
    function getImplementationVersion() external pure returns (string memory) {
        return "V1";
    }

    /* ========== STORAGE GAP ========== */
    // 4 state variables (4 slots) + 45 gap slots = 49 slots total
    uint256[45] private __gap;
}
