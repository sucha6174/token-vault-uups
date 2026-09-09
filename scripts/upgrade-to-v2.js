const { ethers, upgrades } = require("hardhat");

async function main() {
  const PROXY_ADDRESS = process.env.PROXY_ADDRESS || "PASTE_PROXY_ADDRESS_HERE";

  if (PROXY_ADDRESS === "PASTE_PROXY_ADDRESS_HERE") {
    console.log("Please set the PROXY_ADDRESS environment variable or edit the script with the proxy address.");
    return;
  }

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
