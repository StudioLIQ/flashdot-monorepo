import { ethers } from "hardhat";

async function main(): Promise<void> {
  const name = process.env["TOKEN_NAME"]?.trim() ?? "Wrapped DOT";
  const symbol = process.env["TOKEN_SYMBOL"]?.trim() ?? "wDOT";
  const decimalsRaw = process.env["TOKEN_DECIMALS"]?.trim() ?? "18";
  const decimals = Number.parseInt(decimalsRaw, 10);

  if (!Number.isFinite(decimals) || decimals < 0 || decimals > 18) {
    throw new Error(`Invalid TOKEN_DECIMALS: ${decimalsRaw}`);
  }

  const [deployer] = await ethers.getSigners();
  console.log("Deploying ERC20Mock with:");
  console.log(`  Deployer: ${deployer.address}`);
  console.log(`  Name:     ${name}`);
  console.log(`  Symbol:   ${symbol}`);
  console.log(`  Decimals: ${decimals}`);

  const TokenFactory = await ethers.getContractFactory("ERC20Mock");
  const token = await TokenFactory.deploy(name, symbol, decimals);
  await token.waitForDeployment();

  console.log(`\nERC20Mock deployed: ${await token.getAddress()}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
