const { ethers, upgrades } = require("hardhat");

async function main() {
  const PROXY_ADDRESS = "PASTE_PROXY_ADDRESS_HERE";

  const TokenVaultV3 = await ethers.getContractFactory("TokenVaultV3");

  console.log("Upgrading proxy to TokenVaultV3...");
  const vaultV3 = await upgrades.upgradeProxy(
    PROXY_ADDRESS,
    TokenVaultV3
  );

  console.log("Upgrade to V3 complete. Proxy address:", vaultV3.target);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
