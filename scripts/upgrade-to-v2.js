const { ethers, upgrades } = require("hardhat");

async function main() {
  const PROXY_ADDRESS = "PASTE_PROXY_ADDRESS_HERE";

  const TokenVaultV2 = await ethers.getContractFactory("TokenVaultV2");

  console.log("Upgrading proxy to TokenVaultV2...");
  const vaultV2 = await upgrades.upgradeProxy(
    PROXY_ADDRESS,
    TokenVaultV2
  );

  console.log("Upgrade to V2 complete. Proxy address:", vaultV2.target);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
