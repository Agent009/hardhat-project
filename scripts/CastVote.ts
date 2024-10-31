import { createPublicClient, http, createWalletClient, formatEther, hexToString, toHex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { abi, bytecode } from "../artifacts/contracts/Ballot.sol/Ballot.json";
import { constants } from "../lib/constants";

const PROPOSAL_NAME_IDX = 0;
const PROPOSAL_VOTES_IDX = 1;

async function main() {
  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http(constants.integrations.alchemy.sepolia),
  });
  const blockNumber = await publicClient.getBlockNumber();
  console.log("scripts -> CastNote -> last block number", blockNumber);

  // Create a wallet client
  const account = privateKeyToAccount(`0x${constants.account.deployerPrivateKey}`);
  const deployer = createWalletClient({
    account,
    chain: sepolia,
    transport: http(constants.integrations.alchemy.sepolia),
  });
  console.log("scripts -> CastNote -> deployer address", deployer.account.address);
  const balance = await publicClient.getBalance({
    address: deployer.account.address,
  });
  console.log(
    "scripts -> CastNote -> deployer balance",
    formatEther(balance),
    deployer.chain.nativeCurrency.symbol
  );

  // Fetch parameters
  const ARG_PROPOSAL_NO_IDX = 0;
  const ARG_CONTRACT_ADDRESS_IDX = 1;
  const parameters = process.argv.slice(2);
  const proposalIndex = parameters[ARG_PROPOSAL_NO_IDX];
  const contractAddress = parameters[ARG_CONTRACT_ADDRESS_IDX] as `0x${string}` || constants.contracts.ballot.sepolia;

  if (!parameters || parameters.length < 1)
    throw new Error("Parameters not provided. You must at least provide the proposal ID.");
  
  if (isNaN(Number(proposalIndex))) throw new Error("Invalid proposal index");
  
  if (!contractAddress) throw new Error("Contract address not provided. Either set this in your environment variables, or provide it in the arguments.");
  
  if (!/^0x[a-fA-F0-9]{40}$/.test(contractAddress))
    throw new Error("Invalid contract address provided.");

  console.log("scripts -> CastNote -> contract", contractAddress, "proposal", proposalIndex);
  const proposal = (await publicClient.readContract({
    address: contractAddress,
    abi,
    functionName: "proposals",
    args: [BigInt(proposalIndex)],
  })) as any[];
  const name = hexToString(proposal[PROPOSAL_NAME_IDX], { size: 32 });
  console.log("scripts -> CastNote -> Voting to proposal", name);
  console.log("scripts -> CastNote -> Confirm? (Y/n)");

  const stdin = process.stdin;
  // Set encoding to handle string input
  stdin.setEncoding('utf8');
  stdin.on("data", async function (d) {
    if (d.toString().trim().toLowerCase() != "n") {
      const hash = await deployer.writeContract({
        address: contractAddress,
        abi,
        functionName: "vote",
        args: [BigInt(proposalIndex)],
      });
      console.log("scripts -> CastNote -> transaction hash", hash, "waiting for confirmations...");
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      console.log("scripts -> CastNote -> transaction confirmed", receipt);

      if (receipt.status === "success") {
        console.log("scripts -> CastNote -> transaction succeeded");
      } else {
        console.error("scripts -> CastNote -> transaction failed");
      }
    } else {
      console.log("scripts -> CastNote -> operation cancelled");
    }

    process.exit();
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
