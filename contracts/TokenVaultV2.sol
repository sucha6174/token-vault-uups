// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "./TokenVaultV1.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";



contract TokenVaultV2 is TokenVaultV1, PausableUpgradeable {
    uint256 internal yieldRate; // basis points
    mapping(address => uint256) internal lastClaimTime;
    function initializeV2(uint256 _yieldRate) external reinitializer(2) {
        __Pausable_init();
        yieldRate = _yieldRate;
    }
        function setYieldRate(uint256 _yieldRate) external onlyRole(DEFAULT_ADMIN_ROLE) {
        yieldRate = _yieldRate;
    }
        function getYieldRate() external view returns (uint256) {
        return yieldRate;
    }

        function getUserYield(address user) public view returns (uint256) {
        uint256 lastTime = lastClaimTime[user];
if (lastTime == 0) {
    lastTime = block.timestamp - 1;
}


        uint256 timeElapsed = block.timestamp - lastTime;
        uint256 userBalance = balances[user];

        if (userBalance == 0 || yieldRate == 0) {
            return 0;
        }

        return (userBalance * yieldRate * timeElapsed) / (365 days * 10000);
    }
    function claimYield() external returns (uint256) {
        uint256 yieldAmount = getUserYield(msg.sender);
        require(yieldAmount > 0, "No yield to claim");

        lastClaimTime[msg.sender] = block.timestamp;
        balances[msg.sender] += yieldAmount;
        _totalDeposits += yieldAmount;

        return yieldAmount;
    }
    function pauseDeposits() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpauseDeposits() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    function isDepositsPaused() external view returns (bool) {
        return paused();
    }
    function deposit(uint256 amount) public override whenNotPaused {
    super.deposit(amount);
}

    uint256[44] private __gap;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }
}



