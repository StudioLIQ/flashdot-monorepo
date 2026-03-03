import { ethers } from "hardhat";

function requiredEnv(key: string): string {
  const value = process.env[key]?.trim();
  if (!value) {
    throw new Error(`Missing required env var: ${key}`);
  }
  return value;
}

async function main(): Promise<void> {
  const xcmExecutor = requiredEnv("XCM_EXECUTOR");
  const feeRecipient = requiredEnv("FEE_RECIPIENT");
  const xcmPrecompile =
    process.env["XCM_PRECOMPILE_ADDRESS"]?.trim() ?? "0x0000000000000000000000000000000000000800";

  const supportedChains = (process.env["SUPPORTED_CHAINS"] ?? "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);

  const [deployer] = await ethers.getSigners();
  console.log("Deploying FlashDotHub with:");
  console.log(`  Deployer:       ${deployer.address}`);
  console.log(`  XCM executor:   ${xcmExecutor}`);
  console.log(`  Fee recipient:  ${feeRecipient}`);
  console.log(`  XCM precompile: ${xcmPrecompile}`);

  const HubFactory = await ethers.getContractFactory("FlashDotHub");
  const hub = await HubFactory.deploy(xcmExecutor, feeRecipient, xcmPrecompile);
  await hub.waitForDeployment();

  const hubAddress = await hub.getAddress();
  console.log(`\nFlashDotHub deployed: ${hubAddress}`);

  if (supportedChains.length > 0) {
    const chainHashes = supportedChains.map((name) => ethers.keccak256(ethers.toUtf8Bytes(name)));
    const tx = await hub.setSupportedChains(chainHashes);
    await tx.wait();
    console.log("Supported chains set:");
    for (let i = 0; i < supportedChains.length; i += 1) {
      console.log(`  ${supportedChains[i]} -> ${chainHashes[i]}`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
