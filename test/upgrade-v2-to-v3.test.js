const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("Upgrade V2 to V3", function () {
  let owner;
  let user;
  let token;
  let vault;

  beforeEach(async function () {
    [owner, user] = await ethers.getSigners();

    // Deploy mock token
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    token = await MockERC20.deploy();
    await token.waitForDeployment();

    // Deploy V1
    const TokenVaultV1 = await ethers.getContractFactory("TokenVaultV1");
    vault = await upgrades.deployProxy(
      TokenVaultV1,
      [token.target, owner.address, 500],
      { kind: "uups" }
    );
    await vault.waitForDeployment();

    // Upgrade to V2
    const TokenVaultV2 = await ethers.getContractFactory("TokenVaultV2");
    vault = await upgrades.upgradeProxy(vault.target, TokenVaultV2);

    // Set yield rate
    await vault.connect(owner).setYieldRate(500);

    // Give user tokens and deposit
    await token.transfer(user.address, ethers.parseEther("100"));
    await token.connect(user).approve(vault.target, ethers.parseEther("100"));
    await vault.connect(user).deposit(ethers.parseEther("100"));
  });

  it("should preserve all V2 state after upgrade", async function () {
    const balanceBefore = await vault.balanceOf(user.address);
    const totalBefore = await vault.totalDeposits();

    const TokenVaultV3 = await ethers.getContractFactory("TokenVaultV3");
    const vaultV3 = await upgrades.upgradeProxy(vault.target, TokenVaultV3);

    expect(await vaultV3.balanceOf(user.address)).to.equal(balanceBefore);
    expect(await vaultV3.totalDeposits()).to.equal(totalBefore);
  });

  it("should allow setting withdrawal delay", async function () {
    const TokenVaultV3 = await ethers.getContractFactory("TokenVaultV3");
    const vaultV3 = await upgrades.upgradeProxy(vault.target, TokenVaultV3);

    await vaultV3.connect(owner).setWithdrawalDelay(3600);
    expect(await vaultV3.getWithdrawalDelay()).to.equal(3600);
  });

  it("should handle withdrawal requests correctly", async function () {
    const TokenVaultV3 = await ethers.getContractFactory("TokenVaultV3");
    const vaultV3 = await upgrades.upgradeProxy(vault.target, TokenVaultV3);

    await vaultV3.connect(owner).setWithdrawalDelay(3600);

    await vaultV3
      .connect(user)
      .requestWithdrawal(ethers.parseEther("50"));

    const req = await vaultV3.getWithdrawalRequest(user.address);
    expect(req.amount).to.equal(ethers.parseEther("50"));
    expect(req.requestTime).to.be.gt(0);
  });

  it("should enforce withdrawal delay", async function () {
    const TokenVaultV3 = await ethers.getContractFactory("TokenVaultV3");
    const vaultV3 = await upgrades.upgradeProxy(vault.target, TokenVaultV3);

    await vaultV3.connect(owner).setWithdrawalDelay(3600);

    await vaultV3
      .connect(user)
      .requestWithdrawal(ethers.parseEther("50"));

    await expect(
      vaultV3.connect(user).executeWithdrawal()
    ).to.be.revertedWith("Withdrawal delay not passed");
  });

  it("should prevent premature withdrawal execution", async function () {
    const TokenVaultV3 = await ethers.getContractFactory("TokenVaultV3");
    const vaultV3 = await upgrades.upgradeProxy(vault.target, TokenVaultV3);

    await vaultV3.connect(owner).setWithdrawalDelay(3600);

    await vaultV3
      .connect(user)
      .requestWithdrawal(ethers.parseEther("50"));

    await expect(
      vaultV3.connect(user).executeWithdrawal()
    ).to.be.reverted;
  });

  it("should allow emergency withdrawals", async function () {
    const TokenVaultV3 = await ethers.getContractFactory("TokenVaultV3");
    const vaultV3 = await upgrades.upgradeProxy(vault.target, TokenVaultV3);

    const balanceBefore = await token.balanceOf(user.address);

    await vaultV3.connect(user).emergencyWithdraw();

    const balanceAfter = await token.balanceOf(user.address);
    expect(balanceAfter).to.be.gt(balanceBefore);
  });
});
