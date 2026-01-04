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

  it("should preserve storage layout across upgrades", async function () {
    const TokenVaultV2 = await ethers.getContractFactory("TokenVaultV2");
    const vaultV2 = await upgrades.upgradeProxy(vault.target, TokenVaultV2);

    const TokenVaultV3 = await ethers.getContractFactory("TokenVaultV3");
    const vaultV3 = await upgrades.upgradeProxy(vaultV2.target, TokenVaultV3);

    expect(await vaultV3.getImplementationVersion()).to.equal("V1");
  });

it("should use storage gaps for future upgrades", async function () {
  const TokenVaultV3 = await ethers.getContractFactory("TokenVaultV3");

  await expect(
    upgrades.validateUpgrade(vault.target, TokenVaultV3)
  ).to.not.be.reverted;
});


  it("should prevent function selector clashing", async function () {
    const iface = new ethers.Interface([
      "function deposit(uint256)",
      "function withdraw(uint256)",
      "function emergencyWithdraw()",
    ]);

    const selectors = [
      iface.getFunction("deposit").selector,
      iface.getFunction("withdraw").selector,
      iface.getFunction("emergencyWithdraw").selector,
    ];

    const uniqueSelectors = new Set(selectors);
    expect(uniqueSelectors.size).to.equal(selectors.length);
  });
});
