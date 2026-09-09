// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "./TokenVaultV2.sol";

/**
 * @title TokenVaultV3
 * @notice Upgrade version 3 of TokenVault, adding a timelocked withdrawal delay mechanism and emergency exits.
 * @dev Inherits TokenVaultV2 storage layout and appends withdrawalDelay, withdrawalRequests, and a 41-slot storage gap.
 */
contract TokenVaultV3 is TokenVaultV2 {
    /* ========== V3 STORAGE (APPENDED ONLY) ========== */
    uint256 internal withdrawalDelay; // Enforced delay between request and execution in seconds

    struct WithdrawalRequest {
        uint256 amount;
        uint256 requestTime;
    }

    mapping(address => WithdrawalRequest) internal withdrawalRequests; // Single active request per user

    /* ========== V3 EVENTS ========== */
    event WithdrawalDelayUpdated(uint256 newDelay);
    event WithdrawalRequested(address indexed user, uint256 amount, uint256 requestTime);
    event WithdrawalExecuted(address indexed user, uint256 amount);
    event EmergencyWithdraw(address indexed user, uint256 amount);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Reinitializer for V3 upgrade.
     * @dev Configures the initial withdrawal delay in seconds.
     * @param _delaySeconds Enforced delay in seconds before a withdrawal can be executed.
     */
    function initializeV3(uint256 _delaySeconds) external reinitializer(3) {
        withdrawalDelay = _delaySeconds;
        emit WithdrawalDelayUpdated(_delaySeconds);
    }

    /* ========== WITHDRAWAL DELAY LOGIC ========== */

    /**
     * @notice Configures the withdrawal delay period.
     * @dev Restricted to DEFAULT_ADMIN_ROLE.
     * @param _delaySeconds Enforced delay in seconds.
     */
    function setWithdrawalDelay(uint256 _delaySeconds)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        withdrawalDelay = _delaySeconds;
        emit WithdrawalDelayUpdated(_delaySeconds);
    }

    /**
     * @notice Returns the current withdrawal delay duration in seconds.
     * @return The withdrawal delay in seconds.
     */
    function getWithdrawalDelay() external view returns (uint256) {
        return withdrawalDelay;
    }

    /**
     * @notice Submits a withdrawal request. Overwrites/cancels any previous pending request.
     * @dev Enforces user balance check and updates requestTime to block.timestamp.
     * @param amount The token amount requested to withdraw.
     */
    function requestWithdrawal(uint256 amount) external {
        require(amount > 0, "Invalid amount");
        require(balances[msg.sender] >= amount, "Insufficient balance");

        withdrawalRequests[msg.sender] = WithdrawalRequest({
            amount: amount,
            requestTime: block.timestamp
        });

        emit WithdrawalRequested(msg.sender, amount, block.timestamp);
    }

    /**
     * @notice Executes a previously requested withdrawal after the delay has elapsed.
     * @return The amount of tokens withdrawn.
     */
    function executeWithdrawal() external returns (uint256) {
        WithdrawalRequest memory req = withdrawalRequests[msg.sender];

        require(req.amount > 0, "No pending request");
        require(
            block.timestamp >= req.requestTime + withdrawalDelay,
            "Withdrawal delay not passed"
        );
        require(balances[msg.sender] >= req.amount, "Insufficient balance");

        delete withdrawalRequests[msg.sender];

        balances[msg.sender] -= req.amount;
        _totalDeposits -= req.amount;

        emit WithdrawalExecuted(msg.sender, req.amount);

        token.transfer(msg.sender, req.amount);

        return req.amount;
    }

    /**
     * @notice Returns the pending withdrawal request details for a user.
     * @param user The address of the user.
     * @return amount The requested amount.
     * @return requestTime The block timestamp when the request was submitted.
     */
    function getWithdrawalRequest(address user)
        external
        view
        returns (uint256 amount, uint256 requestTime)
    {
        WithdrawalRequest memory req = withdrawalRequests[user];
        return (req.amount, req.requestTime);
    }

    /* ========== EMERGENCY ========== */

    /**
     * @notice Immediately withdraws all user funds, bypassing any withdrawal delays and clearing pending requests.
     * @dev Provides emergency escape mechanism for depositors.
     * @return The amount of tokens withdrawn.
     */
    function emergencyWithdraw() external returns (uint256) {
        uint256 amount = balances[msg.sender];
        require(amount > 0, "Nothing to withdraw");

        balances[msg.sender] = 0;
        _totalDeposits -= amount;

        delete withdrawalRequests[msg.sender];

        emit EmergencyWithdraw(msg.sender, amount);

        token.transfer(msg.sender, amount);
        return amount;
    }

    /* ========== STORAGE GAP ========== */
    // V2 had 43 gap slots. V3 adds 2 variables (withdrawalDelay, withdrawalRequests).
    // Reduced gap size: 43 - 2 = 41 slots.
    uint256[41] private __gap;
}
