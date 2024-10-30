import { createPublicClient, http, createWalletClient, formatEther, hexToString, toHex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { abi, bytecode } from "../artifacts/contracts/Ballot.sol/Ballot.json";
import { constants } from "../lib/constants";


async function main() {
  // Fetch proposals
  const proposals = process.argv.slice(2);
  if (!proposals || proposals.length < 1)
    throw new Error("scripts -> DeployWithViem -> Proposals not provided");
  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http(constants.integrations.alchemy.sepolia),
  });
  const blockNumber = await publicClient.getBlockNumber();
  console.log("scripts -> DeployWithViem -> Last block number:", blockNumber);

  // Create a wallet client
  const account = privateKeyToAccount(`0x${constants.account.deployerPrivateKey}`);
  const deployer = createWalletClient({
    account,
    chain: sepolia,
    transport: http(constants.integrations.alchemy.sepolia),
  });
  console.log("scripts -> DeployWithViem -> Deployer address:", deployer.account.address);
  const balance = await publicClient.getBalance({
    address: deployer.account.address,
  });
  console.log(
    "scripts -> DeployWithViem -> Deployer balance:",
    formatEther(balance),
    deployer.chain.nativeCurrency.symbol
  );

  // Deploy contract
  console.log("\nscripts -> DeployWithViem -> Deploying Ballot contract");
  const hash = await deployer.deployContract({
    abi,
    bytecode: bytecode as `0x${string}`,
    args: [proposals.map((prop) => toHex(prop, { size: 32 }))],
  });
  console.log("scripts -> DeployWithViem -> Transaction hash:", hash);
  console.log("scripts -> DeployWithViem -> Waiting for confirmations...");
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log("scripts -> DeployWithViem -> Ballot contract deployed to:", receipt.contractAddress);

  // Reading information from a deployed contract
  console.log("scripts -> DeployWithViem -> Proposals: ");
  for (let index = 0; index < proposals.length; index++) {
    const proposal = (await publicClient.readContract({
      // @ts-expect-error ignore
      address: receipt.contractAddress,
      abi,
      functionName: "proposals",
      args: [BigInt(index)],
    })) as any[];
    const name = hexToString(proposal[0], { size: 32 });
    console.log({ index, name, proposal });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});