import { createPublicClient, http, createWalletClient, formatEther, hexToString, toHex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { abi, bytecode } from "../artifacts/contracts/Ballot.sol/Ballot.json";
import { constants } from "../lib/constants";


async function main() {
  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http(constants.integrations.alchemy.sepolia),
  });
  const blockNumber = await publicClient.getBlockNumber();
  console.log("scripts -> CastNote -> Last block number:", blockNumber);

  // Fetch parameters
  const parameters = process.argv.slice(2);
  if (!parameters || parameters.length < 2)
    throw new Error("Parameters not provided");
  const contractAddress = parameters[0] as `0x${string}`;
  if (!contractAddress) throw new Error("Contract address not provided");
  if (!/^0x[a-fA-F0-9]{40}$/.test(contractAddress))
    throw new Error("Invalid contract address");
  const proposalIndex = parameters[1];
  if (isNaN(Number(proposalIndex))) throw new Error("Invalid proposal index");

  console.log("scripts -> CastNote -> Proposal selected: ");
  const proposal = (await publicClient.readContract({
    address: contractAddress,
    abi,
    functionName: "proposals",
    args: [BigInt(proposalIndex)],
  })) as any[];
  const name = hexToString(proposal[0], { size: 32 });
  console.log("scripts -> CastNote -> Voting to proposal", name);
  console.log("scripts -> CastNote -> Confirm? (Y/n)");

  // const stdin = process.openStdin();
  // // @ts-expect-error ignore
  // stdin.addListener("data", async function (d) {
  //   if (d.toString().trim().toLowerCase() != "n") {
  //     const hash = await voter.writeContract({
  //       address: contractAddress,
  //       abi,
  //       functionName: "vote",
  //       args: [BigInt(proposalIndex)],
  //     });
  //     console.log("scripts -> CastNote -> Transaction hash:", hash);
  //     console.log("scripts -> CastNote -> Waiting for confirmations...");
  //     const receipt = await publicClient.waitForTransactionReceipt({ hash });
  //     console.log("scripts -> CastNote -> Transaction confirmed");
  //   } else {
  //     console.log("scripts -> CastNote -> Operation cancelled");
  //   }
  //   process.exit();
  // });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
