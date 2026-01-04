const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("Upgrade V1 to V2", function () {
  // upgrade tests will go here
    let owner;
  let user;
  let token;
  let vault;

    beforeEach(async function () {
    [owner, user] = await ethers.getSigners();

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

    // give user tokens
    await token.transfer(user.address, ethers.parseEther("100"));
    await token.connect(user).approve(vault.target, ethers.parseEther("100"));
    await vault.connect(user).deposit(ethers.parseEther("100"));
  });
    it("should preserve user balances after upgrade", async function () {
    const balanceBefore = await vault.balanceOf(user.address);

    const TokenVaultV2 = await ethers.getContractFactory("TokenVaultV2");
    const vaultV2 = await upgrades.upgradeProxy(vault.target, TokenVaultV2);

    const balanceAfter = await vaultV2.balanceOf(user.address);
    expect(balanceAfter).to.equal(balanceBefore);
  });
  it("should preserve total deposits after upgrade", async function () {
    const totalBefore = await vault.totalDeposits();

    const TokenVaultV2 = await ethers.getContractFactory("TokenVaultV2");
    const vaultV2 = await upgrades.upgradeProxy(vault.target, TokenVaultV2);

    const totalAfter = await vaultV2.totalDeposits();
    expect(totalAfter).to.equal(totalBefore);
  });
  it("should maintain admin access control after upgrade", async function () {
    const TokenVaultV2 = await ethers.getContractFactory("TokenVaultV2");
    const vaultV2 = await upgrades.upgradeProxy(vault.target, TokenVaultV2);

    // admin should be able to set yield rate
    await expect(
      vaultV2.connect(owner).setYieldRate(600)
    ).to.not.be.reverted;
  });
  it("should allow setting yield rate in V2", async function () {
    const TokenVaultV2 = await ethers.getContractFactory("TokenVaultV2");
    const vaultV2 = await upgrades.upgradeProxy(vault.target, TokenVaultV2);

    await vaultV2.connect(owner).setYieldRate(500);
    expect(await vaultV2.getYieldRate()).to.equal(500);
  });
  it("should prevent non-admin from setting yield rate", async function () {
    const TokenVaultV2 = await ethers.getContractFactory("TokenVaultV2");
    const vaultV2 = await upgrades.upgradeProxy(vault.target, TokenVaultV2);

    await expect(
      vaultV2.connect(user).setYieldRate(400)
    ).to.be.reverted;
  });
  it("should calculate yield correctly", async function () {
    const TokenVaultV2 = await ethers.getContractFactory("TokenVaultV2");
    const vaultV2 = await upgrades.upgradeProxy(vault.target, TokenVaultV2);

    // set yield rate to 10%
    await vaultV2.connect(owner).setYieldRate(1000);

    // move time forward by 30 days
    await ethers.provider.send("evm_increaseTime", [30 * 24 * 60 * 60]);
    await ethers.provider.send("evm_mine");

    const yieldAmount = await vaultV2.getUserYield(user.address);
    expect(yieldAmount).to.be.gt(0);
  });


});
