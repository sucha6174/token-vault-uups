// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "./TokenVaultV2.sol";

contract TokenVaultV3 is TokenVaultV2 {
    /* ========== V3 STORAGE (APPENDED ONLY) ========== */

    uint256 internal withdrawalDelay; // in seconds

    struct WithdrawalRequest {
        uint256 amount;
        uint256 requestTime;
    }

    mapping(address => WithdrawalRequest) internal withdrawalRequests;

    /* ========== V3 INITIALIZER ========== */

    function initializeV3(uint256 _delaySeconds) external reinitializer(3) {
        withdrawalDelay = _delaySeconds;
    }

    /* ========== WITHDRAWAL DELAY LOGIC ========== */

    function setWithdrawalDelay(uint256 _delaySeconds)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        withdrawalDelay = _delaySeconds;
    }

    function getWithdrawalDelay() external view returns (uint256) {
        return withdrawalDelay;
    }

    function requestWithdrawal(uint256 amount) external {
        require(amount > 0, "Invalid amount");
        require(balances[msg.sender] >= amount, "Insufficient balance");

        withdrawalRequests[msg.sender] = WithdrawalRequest({
            amount: amount,
            requestTime: block.timestamp
        });
    }

    function executeWithdrawal() external returns (uint256) {
        WithdrawalRequest memory req = withdrawalRequests[msg.sender];

        require(req.amount > 0, "No pending request");
        require(
            block.timestamp >= req.requestTime + withdrawalDelay,
            "Withdrawal delay not passed"
        );

        delete withdrawalRequests[msg.sender];

        balances[msg.sender] -= req.amount;
        _totalDeposits -= req.amount;

        token.transfer(msg.sender, req.amount);

        return req.amount;
    }

    function getWithdrawalRequest(address user)
        external
        view
        returns (uint256 amount, uint256 requestTime)
    {
        WithdrawalRequest memory req = withdrawalRequests[user];
        return (req.amount, req.requestTime);
    }

    /* ========== EMERGENCY ========== */

    function emergencyWithdraw() external returns (uint256) {
        uint256 amount = balances[msg.sender];
        require(amount > 0, "Nothing to withdraw");

        balances[msg.sender] = 0;
        _totalDeposits -= amount;

        delete withdrawalRequests[msg.sender];

        token.transfer(msg.sender, amount);
        return amount;
    }

    /* ========== STORAGE GAP ========== */

    uint256[42] private __gap;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }
}
