const { ethers } = require("hardhat");

const ERC20_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
];

async function main() {
  const tokenAddress = "0xf8E60cE6d0119D887801e1F566fF2bd7F0d183ED";

  const [me] = await ethers.getSigners();
  const token = new ethers.Contract(tokenAddress, ERC20_ABI, me);

  console.log("Signer:", me.address);
  console.log("Token:", tokenAddress);

  const name = await token.name();
  const symbol = await token.symbol();
  const decimals = await token.decimals();
  const bal = await token.balanceOf(me.address);

  console.log("name:", name);
  console.log("symbol:", symbol);
  console.log("decimals:", decimals.toString());
  console.log("balance:", ethers.utils.formatUnits(bal, decimals));
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});