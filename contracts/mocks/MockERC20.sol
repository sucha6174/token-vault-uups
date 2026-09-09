// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MockERC20
 * @notice Simple ERC20 mock token used for testing vault deposits, withdrawals, and fee calculations.
 */
contract MockERC20 is ERC20 {
    /**
     * @notice Mints initial supply of 1,000,000 MTK to the deployer.
     */
    constructor() ERC20("Mock Token", "MTK") {
        _mint(msg.sender, 1_000_000 ether);
    }
}
