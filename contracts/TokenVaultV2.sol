// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "./TokenVaultV1.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";

/**
 * @title TokenVaultV2
 * @notice Upgrade version 2 of TokenVault, adding non-compounding yield generation and deposit pause controls.
 * @dev Inherits TokenVaultV1 storage layout and appends yieldRate, lastClaimTime, and a 43-slot storage gap.
 */
contract TokenVaultV2 is TokenVaultV1, PausableUpgradeable {
    /* ========== V2 STORAGE (APPENDED ONLY) ========== */
    uint256 internal yieldRate; // Yield rate in basis points (e.g. 500 = 5% annual yield)
    mapping(address => uint256) internal lastClaimTime; // Last yield claim timestamp per user

    /* ========== V2 EVENTS ========== */
    event YieldRateUpdated(uint256 newYieldRate);
    event YieldClaimed(address indexed user, uint256 amount);
    event DepositsPaused(address indexed account);
    event DepositsUnpaused(address indexed account);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Reinitializer for V2 upgrade.
     * @dev Initializes pausable module and initial yield rate.
     * @param _yieldRate Initial annual yield rate in basis points.
     */
    function initializeV2(uint256 _yieldRate) external reinitializer(2) {
        __Pausable_init();
        yieldRate = _yieldRate;
        if (lastClaimTime[address(0)] == 0) {
            lastClaimTime[address(0)] = block.timestamp;
        }
        emit YieldRateUpdated(_yieldRate);
    }

    /**
     * @notice Sets the annual yield rate in basis points.
     * @dev Restricted to DEFAULT_ADMIN_ROLE.
     * @param _yieldRate Annual yield rate in basis points (e.g., 500 = 5%).
     */
    function setYieldRate(uint256 _yieldRate) external onlyRole(DEFAULT_ADMIN_ROLE) {
        yieldRate = _yieldRate;
        if (lastClaimTime[address(0)] == 0) {
            lastClaimTime[address(0)] = block.timestamp;
        }
        emit YieldRateUpdated(_yieldRate);
    }

    /**
     * @notice Returns the current annual yield rate in basis points.
     * @return The active yield rate.
     */
    function getYieldRate() external view returns (uint256) {
        return yieldRate;
    }

    /**
     * @notice Calculates the accrued, uncompounded yield for a user.
     * @dev Yield = (userBalance * yieldRate * timeElapsed) / (365 days * 10000).
     * @param user The address of the user.
     * @return The accrued yield tokens earned since last claim or deposit.
     */
    function getUserYield(address user) public view returns (uint256) {
        uint256 userBalance = balances[user];
        if (userBalance == 0 || yieldRate == 0) {
            return 0;
        }

        uint256 lastTime = lastClaimTime[user];
        if (lastTime == 0) {
            // For depositors from V1 who upgraded, reference vault yield activation timestamp
            lastTime = lastClaimTime[address(0)];
        }

        if (lastTime == 0 || block.timestamp <= lastTime) {
            return 0;
        }

        uint256 timeElapsed = block.timestamp - lastTime;
        return (userBalance * yieldRate * timeElapsed) / (365 days * 10000);
    }

    /**
     * @notice Claims accrued yield tokens and credits them to the caller's vault balance.
     * @return The amount of yield claimed.
     */
    function claimYield() external returns (uint256) {
        uint256 yieldAmount = getUserYield(msg.sender);
        require(yieldAmount > 0, "No yield to claim");

        lastClaimTime[msg.sender] = block.timestamp;
        balances[msg.sender] += yieldAmount;
        _totalDeposits += yieldAmount;

        emit YieldClaimed(msg.sender, yieldAmount);
        return yieldAmount;
    }

    /**
     * @notice Pauses token deposits into the vault.
     * @dev Restricted to accounts with PAUSER_ROLE.
     */
    function pauseDeposits() external onlyRole(PAUSER_ROLE) {
        _pause();
        emit DepositsPaused(msg.sender);
    }

    /**
     * @notice Unpauses token deposits into the vault.
     * @dev Restricted to accounts with PAUSER_ROLE.
     */
    function unpauseDeposits() external onlyRole(PAUSER_ROLE) {
        _unpause();
        emit DepositsUnpaused(msg.sender);
    }

    /**
     * @notice Checks whether deposits are currently paused.
     * @return True if deposits are paused, false otherwise.
     */
    function isDepositsPaused() external view returns (bool) {
        return paused();
    }

    /**
     * @notice Deposits ERC20 tokens into the vault with pause protection and yield checkpointing.
     * @param amount The amount of tokens to deposit.
     */
    function deposit(uint256 amount) public override whenNotPaused {
        if (balances[msg.sender] > 0 && lastClaimTime[msg.sender] != 0) {
            uint256 accrued = getUserYield(msg.sender);
            if (accrued > 0) {
                balances[msg.sender] += accrued;
                _totalDeposits += accrued;
                emit YieldClaimed(msg.sender, accrued);
            }
        }
        lastClaimTime[msg.sender] = block.timestamp;
        super.deposit(amount);
    }

    /* ========== STORAGE GAP ========== */
    // V1 reserved 49 slots (4 vars + 45 gap). V2 adds 2 vars (yieldRate, lastClaimTime).
    // Reduced gap size: 45 - 2 = 43 slots. Total slots preserved = 49.
    uint256[43] private __gap;
}
