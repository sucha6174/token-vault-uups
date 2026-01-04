const { ethers, upgrades } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  const MockERC20 = await ethers.getContractFactory("MockERC20");
  const token = await MockERC20.deploy();
  await token.waitForDeployment();

  console.log("MockERC20 deployed to:", token.target);

  const TokenVaultV1 = await ethers.getContractFactory("TokenVaultV1");

  const vault = await upgrades.deployProxy(
    TokenVaultV1,
    [token.target, deployer.address, 500],
    { kind: "uups" }
  );
  await vault.waitForDeployment();

  console.log("TokenVaultV1 proxy deployed to:", vault.target);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
