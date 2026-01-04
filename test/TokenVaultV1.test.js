const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("TokenVaultV1", function () {
  // tests will go here
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
  });

    it("should initialize with correct parameters", async function () {
    expect(await vault.getDepositFee()).to.equal(500);
    expect(await vault.totalDeposits()).to.equal(0);
  });

  it("should allow deposits and update balances", async function () {
    // give user some tokens
    await token.transfer(user.address, ethers.parseEther("100"));

    // user approves vault
    await token.connect(user).approve(vault.target, ethers.parseEther("100"));

    // user deposits
    await vault.connect(user).deposit(ethers.parseEther("100"));

    // balance should be > 0
    const balance = await vault.balanceOf(user.address);
    expect(balance).to.be.gt(0);
  });

    it("should deduct deposit fee correctly", async function () {
    // give user tokens
    await token.transfer(user.address, ethers.parseEther("100"));

    // approve vault
    await token.connect(user).approve(vault.target, ethers.parseEther("100"));

    // deposit 100 tokens
    await vault.connect(user).deposit(ethers.parseEther("100"));

    // expected balance after 5% fee = 95
    const balance = await vault.balanceOf(user.address);
    expect(balance).to.equal(ethers.parseEther("95"));

    // total deposits should also be 95
    expect(await vault.totalDeposits()).to.equal(ethers.parseEther("95"));
  });

    it("should allow withdrawals and update balances", async function () {
    // give user tokens
    await token.transfer(user.address, ethers.parseEther("100"));

    // approve vault
    await token.connect(user).approve(vault.target, ethers.parseEther("100"));

    // deposit 100 (balance becomes 95 after fee)
    await vault.connect(user).deposit(ethers.parseEther("100"));

    // withdraw 50
    await vault.connect(user).withdraw(ethers.parseEther("50"));

    // remaining balance should be 45
    const balance = await vault.balanceOf(user.address);
    expect(balance).to.equal(ethers.parseEther("45"));

    // total deposits should also be 45
    expect(await vault.totalDeposits()).to.equal(ethers.parseEther("45"));
  });

  it("should prevent withdrawal of more than balance", async function () {
    // give user tokens
    await token.transfer(user.address, ethers.parseEther("100"));

    // approve vault
    await token.connect(user).approve(vault.target, ethers.parseEther("100"));

    // deposit 100 (balance becomes 95 after fee)
    await vault.connect(user).deposit(ethers.parseEther("100"));

    // try to withdraw more than balance
    await expect(
      vault.connect(user).withdraw(ethers.parseEther("200"))
    ).to.be.revertedWith("Insufficient balance");
  });

    it("should prevent reinitialization", async function () {
    await expect(
      vault.initialize(token.target, owner.address, 500)
    ).to.be.reverted;
  });

});
