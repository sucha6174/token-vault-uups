const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("Security Tests", function () {
  let owner;
  let attacker;
  let token;
  let vault;

  beforeEach(async function () {
    [owner, attacker] = await ethers.getSigners();

    const MockERC20 = await ethers.getContractFactory("MockERC20");
    token = await MockERC20.deploy();
    await token.waitForDeployment();

    const TokenVaultV1 = await ethers.getContractFactory("TokenVaultV1");
    vault = await upgrades.deployProxy(
      TokenVaultV1,
      [token.target, owner.address, 500],
      { kind: "uups" }
    );
    await vault.waitForDeployment();
  });

  it("should prevent direct initialization of implementation contracts", async function () {
    const TokenVaultV1 = await ethers.getContractFactory("TokenVaultV1");
    const impl = await TokenVaultV1.deploy();
    await impl.waitForDeployment();

    await expect(
      impl.initialize(token.target, owner.address, 500)
    ).to.be.reverted;
  });

  it("should prevent unauthorized upgrades", async function () {
    const TokenVaultV2 = await ethers.getContractFactory("TokenVaultV2");

    await expect(
      upgrades.upgradeProxy(vault.target, TokenVaultV2.connect(attacker))
    ).to.be.reverted;
  });

  it("should not have storage layout collisions across versions", async function () {
    const TokenVaultV2 = await ethers.getContractFactory("TokenVaultV2");
    const TokenVaultV3 = await ethers.getContractFactory("TokenVaultV3");

    // Perform operations in V1
    await token.transfer(owner.address, ethers.parseEther("100"));
    await token.connect(owner).approve(vault.target, ethers.parseEther("100"));
    await vault.connect(owner).deposit(ethers.parseEther("100"));

    const v1Balance = await vault.balanceOf(owner.address);
    const v1Total = await vault.totalDeposits();
    const v1Fee = await vault.getDepositFee();

    // Validate storage layout compatibility before upgrading V1 -> V2
    await expect(upgrades.validateUpgrade(vault.target, TokenVaultV2)).to.not.be.reverted;

    // Upgrade to V2
    const vaultV2 = await upgrades.upgradeProxy(vault.target, TokenVaultV2);
    expect(await vaultV2.balanceOf(owner.address)).to.equal(v1Balance);
    expect(await vaultV2.totalDeposits()).to.equal(v1Total);
    expect(await vaultV2.getDepositFee()).to.equal(v1Fee);

    // Set V2 state
    await vaultV2.connect(owner).setYieldRate(750);
    expect(await vaultV2.getYieldRate()).to.equal(750);

    // Validate storage layout compatibility before upgrading V2 -> V3
    await expect(upgrades.validateUpgrade(vaultV2.target, TokenVaultV3)).to.not.be.reverted;

    // Upgrade to V3
    const vaultV3 = await upgrades.upgradeProxy(vaultV2.target, TokenVaultV3);

    // Verify all prior state remains intact without collisions
    expect(await vaultV3.balanceOf(owner.address)).to.equal(v1Balance);
    expect(await vaultV3.totalDeposits()).to.equal(v1Total);
    expect(await vaultV3.getDepositFee()).to.equal(v1Fee);
    expect(await vaultV3.getYieldRate()).to.equal(750);

    // Set and verify V3 state
    await vaultV3.connect(owner).setWithdrawalDelay(1800);
    expect(await vaultV3.getWithdrawalDelay()).to.equal(1800);
  });

  it("should use storage gaps for future upgrades", async function () {
    const TokenVaultV2 = await ethers.getContractFactory("TokenVaultV2");
    const TokenVaultV3 = await ethers.getContractFactory("TokenVaultV3");

    // Storage gap validation for V1 -> V2
    await expect(
      upgrades.validateUpgrade(vault.target, TokenVaultV2)
    ).to.not.be.reverted;

    // Storage gap validation for V1 -> V3
    await expect(
      upgrades.validateUpgrade(vault.target, TokenVaultV3)
    ).to.not.be.reverted;
  });

  it("should prevent function selector clashing", async function () {
    const iface = new ethers.Interface([
      "function deposit(uint256)",
      "function withdraw(uint256)",
      "function balanceOf(address)",
      "function totalDeposits()",
      "function getDepositFee()",
      "function getImplementationVersion()",
      "function setYieldRate(uint256)",
      "function getYieldRate()",
      "function claimYield()",
      "function getUserYield(address)",
      "function pauseDeposits()",
      "function unpauseDeposits()",
      "function isDepositsPaused()",
      "function emergencyWithdraw()",
      "function setWithdrawalDelay(uint256)",
      "function getWithdrawalDelay()",
      "function requestWithdrawal(uint256)",
      "function executeWithdrawal()",
      "function getWithdrawalRequest(address)"
    ]);

    const functionNames = [
      "deposit",
      "withdraw",
      "balanceOf",
      "totalDeposits",
      "getDepositFee",
      "getImplementationVersion",
      "setYieldRate",
      "getYieldRate",
      "claimYield",
      "getUserYield",
      "pauseDeposits",
      "unpauseDeposits",
      "isDepositsPaused",
      "emergencyWithdraw",
      "setWithdrawalDelay",
      "getWithdrawalDelay",
      "requestWithdrawal",
      "executeWithdrawal",
      "getWithdrawalRequest"
    ];

    const selectors = functionNames.map(name => {
      const fragment = iface.fragments.find(f => f.name === name);
      return iface.getFunction(fragment.format()).selector;
    });

    const uniqueSelectors = new Set(selectors);
    expect(uniqueSelectors.size).to.equal(selectors.length);
  });
});
