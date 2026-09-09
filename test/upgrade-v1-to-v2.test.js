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

  it("should allow pausing deposits in V2", async function () {
    const TokenVaultV2 = await ethers.getContractFactory("TokenVaultV2");
    const vaultV2 = await upgrades.upgradeProxy(vault.target, TokenVaultV2);

    // Ensure deposits are not paused initially
    expect(await vaultV2.isDepositsPaused()).to.be.false;

    // Pause deposits with pauser/admin role
    await vaultV2.connect(owner).pauseDeposits();
    expect(await vaultV2.isDepositsPaused()).to.be.true;

    // Try to deposit and expect it to revert while paused
    await token.transfer(user.address, ethers.parseEther("10"));
    await token.connect(user).approve(vaultV2.target, ethers.parseEther("10"));
    await expect(
      vaultV2.connect(user).deposit(ethers.parseEther("10"))
    ).to.be.reverted;

    // Unpause deposits
    await vaultV2.connect(owner).unpauseDeposits();
    expect(await vaultV2.isDepositsPaused()).to.be.false;

    // Deposit should succeed now
    await expect(
      vaultV2.connect(user).deposit(ethers.parseEther("10"))
    ).to.not.be.reverted;
  });

  it("should allow claiming yield in V2 and prevent double claiming", async function () {
    const TokenVaultV2 = await ethers.getContractFactory("TokenVaultV2");
    const vaultV2 = await upgrades.upgradeProxy(vault.target, TokenVaultV2);

    await vaultV2.connect(owner).setYieldRate(1000);

    // Advance 30 days
    await ethers.provider.send("evm_increaseTime", [30 * 24 * 60 * 60]);
    await ethers.provider.send("evm_mine");

    const yieldEstimate = await vaultV2.getUserYield(user.address);
    expect(yieldEstimate).to.be.gt(0);

    const balanceBefore = await vaultV2.balanceOf(user.address);
    const tx = await vaultV2.connect(user).claimYield();
    await expect(tx).to.emit(vaultV2, "YieldClaimed");

    const balanceAfter = await vaultV2.balanceOf(user.address);
    expect(balanceAfter).to.be.gt(balanceBefore);
    expect(balanceAfter - balanceBefore).to.be.gte(yieldEstimate);

    // Yield has just been claimed; pending yield should now be 0
    expect(await vaultV2.getUserYield(user.address)).to.equal(0);

    // Set yield rate to 0 to verify reverting when there is no yield to claim
    await vaultV2.connect(owner).setYieldRate(0);
    await expect(
      vaultV2.connect(user).claimYield()
    ).to.be.revertedWith("No yield to claim");
  });

  it("should prevent non-pausers from pausing or unpausing", async function () {
    const TokenVaultV2 = await ethers.getContractFactory("TokenVaultV2");
    const vaultV2 = await upgrades.upgradeProxy(vault.target, TokenVaultV2);

    await expect(
      vaultV2.connect(user).pauseDeposits()
    ).to.be.reverted;

    await vaultV2.connect(owner).pauseDeposits();

    await expect(
      vaultV2.connect(user).unpauseDeposits()
    ).to.be.reverted;
  });

  it("should return zero yield if user has zero balance or yield rate is zero", async function () {
    const TokenVaultV2 = await ethers.getContractFactory("TokenVaultV2");
    const vaultV2 = await upgrades.upgradeProxy(vault.target, TokenVaultV2);

    const [, , stranger] = await ethers.getSigners();

    // Zero balance
    await vaultV2.connect(owner).setYieldRate(1000);
    expect(await vaultV2.getUserYield(stranger.address)).to.equal(0);

    // Zero yield rate
    await vaultV2.connect(owner).setYieldRate(0);
    expect(await vaultV2.getUserYield(user.address)).to.equal(0);
  });

  it("should support upgrading and calling initializeV2 as a reinitializer", async function () {
    const TokenVaultV2 = await ethers.getContractFactory("TokenVaultV2");
    const vaultV2 = await upgrades.upgradeProxy(vault.target, TokenVaultV2, {
      call: { fn: "initializeV2", args: [800] }
    });
    expect(await vaultV2.getYieldRate()).to.equal(800);
  });

  it("should checkpoint accrued yield on subsequent deposits in V2", async function () {
    const TokenVaultV2 = await ethers.getContractFactory("TokenVaultV2");
    const vaultV2 = await upgrades.upgradeProxy(vault.target, TokenVaultV2);

    await vaultV2.connect(owner).setYieldRate(1000);

    // Initial deposit in V2 to initialize lastClaimTime for user
    await token.transfer(user.address, ethers.parseEther("50"));
    await token.connect(user).approve(vaultV2.target, ethers.parseEther("50"));
    await vaultV2.connect(user).deposit(ethers.parseEther("50"));

    // Advance 30 days so yield accrues
    await ethers.provider.send("evm_increaseTime", [30 * 24 * 60 * 60]);
    await ethers.provider.send("evm_mine");

    const accruedBefore = await vaultV2.getUserYield(user.address);
    expect(accruedBefore).to.be.gt(0);

    // Deposit again: should credit accrued yield automatically
    await token.transfer(user.address, ethers.parseEther("20"));
    await token.connect(user).approve(vaultV2.target, ethers.parseEther("20"));

    const balanceBefore = await vaultV2.balanceOf(user.address);
    await expect(vaultV2.connect(user).deposit(ethers.parseEther("20")))
      .to.emit(vaultV2, "YieldClaimed");

    const balanceAfter = await vaultV2.balanceOf(user.address);
    // Credited deposit is 20 - 5% fee = 19
    expect(balanceAfter).to.be.gt(balanceBefore + ethers.parseEther("19"));
  });
});
