import { ethers } from "hardhat";

function requiredEnv(key: string): string {
  const value = process.env[key]?.trim();
  if (!value) {
    throw new Error(`Missing required env var: ${key}`);
  }
  return value;
}

async function main(): Promise<void> {
  const asset = requiredEnv("ASSET_ADDRESS");
  const hubSovereign = requiredEnv("HUB_SOVEREIGN_ACCOUNT");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying FlashDotVault with:");
  console.log(`  Deployer:      ${deployer.address}`);
  console.log(`  Asset:         ${asset}`);
  console.log(`  Hub sovereign: ${hubSovereign}`);

  const VaultFactory = await ethers.getContractFactory("FlashDotVault");
  const vault = await VaultFactory.deploy(asset, hubSovereign);
  await vault.waitForDeployment();

  console.log(`\nFlashDotVault deployed: ${await vault.getAddress()}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
