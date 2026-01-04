// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";


contract TokenVaultV1 is Initializable, UUPSUpgradeable, AccessControlUpgradeable {
bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");
    IERC20 internal token;

    uint256 internal depositFee;        // fee in basis points
    uint256 internal _totalDeposits;

    mapping(address => uint256) internal balances;

    function initialize(
        address _token,
        address _admin,
        uint256 _depositFee
    ) external initializer {
        __AccessControl_init();
        __UUPSUpgradeable_init();

        token = IERC20(_token);

        depositFee = _depositFee;

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(UPGRADER_ROLE, _admin);
    }

        function _authorizeUpgrade(address)
        internal
        override
        onlyRole(UPGRADER_ROLE)
    {}

        function deposit(uint256 amount) public virtual {

        require(amount > 0, "Amount must be > 0");

        uint256 fee = (amount * depositFee) / 10000;
        uint256 credited = amount - fee;

        balances[msg.sender] += credited;
        _totalDeposits += credited;

        token.transferFrom(msg.sender, address(this), amount);
    }


    function withdraw(uint256 amount) external {
        require(amount > 0, "Amount must be > 0");
        require(balances[msg.sender] >= amount, "Insufficient balance");

        balances[msg.sender] -= amount;
        _totalDeposits -= amount;

        token.transfer(msg.sender, amount);
    }

    function balanceOf(address user) external view returns (uint256) {
        return balances[user];
    }

    function totalDeposits() external view returns (uint256) {
        return _totalDeposits;
    }

    function getDepositFee() external view returns (uint256) {
        return depositFee;
    }

    function getImplementationVersion() external pure returns (string memory) {
        return "V1";
    }

    uint256[45] private __gap;
     /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }
}



