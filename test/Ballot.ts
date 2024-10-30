import { expect } from "chai";
import { toHex, hexToString } from "viem";
import { viem } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import {PublicClient, WalletClient} from "@nomicfoundation/hardhat-viem/src/types";

const CONTRACT_NAME = "Ballot";
const PROPOSALS = ["Proposal 1", "Proposal 2", "Proposal 3"];
const PROPOSAL_NAME_IDX = 0;
const PROPOSAL_VOTES_IDX = 1;
const VOTER_WEIGHT_IDX = 0;
const VOTER_VOTED_IDX = 1;
const VOTER_DELEGATED_IDX = 2;
const VOTER_VOTE_IDX = 3;

const deployContract = async () => {
  const publicClient: PublicClient = await viem.getPublicClient();
  const [deployer, otherAccount, otherAccount2] = await viem.getWalletClients();
  const deployerAddress = deployer.account.address;
  const otherAddress = otherAccount.account.address;
  const ballotContract = await viem.deployContract(CONTRACT_NAME, [
    PROPOSALS.map((prop) => toHex(prop, { size: 32 })),
  ]);
  return { publicClient, deployer, deployerAddress, otherAccount, otherAccount2, otherAddress, ballotContract };
};

const giveRightToVoteFixture = async (publicClient: PublicClient, ballotContract: any, toAddress: string) => {
  // https://hardhat.org/hardhat-runner/plugins/nomicfoundation-hardhat-viem#contracts
  const txHash = await ballotContract.write.giveRightToVote([
    toAddress,
  ]);
  // https://viem.sh/docs/actions/public/getTransactionReceipt#gettransactionreceipt
  const receipt = await publicClient.getTransactionReceipt({ hash: txHash });
  // console.log("Ballot -> giveRightToVoteFixture -> txHash", txHash, "receipt", receipt);
  // https://viem.sh/docs/glossary/terms#transaction-receipt
  expect(receipt.status).to.equal("success");
  const otherVoter = await ballotContract.read.voters([toAddress]);
  // console.log("Ballot -> giveRightToVoteFixture -> voting weights -> otherAccount", otherVoter);
  expect(otherVoter[VOTER_WEIGHT_IDX]).to.eq(1n);
};

const voteFixture = async (ballotContract: any, proposalIdx: number, toAccount: WalletClient) => {
  const contractAsOtherAccount = await viem.getContractAt(
    CONTRACT_NAME,
    ballotContract.address,
    { client: { wallet: toAccount } }
  );
  const proposal = await ballotContract.read.proposals([BigInt(proposalIdx)]);
  expect(proposal[PROPOSAL_VOTES_IDX]).to.eq(0n);
  // https://www.chaijs.com/plugins/chai-as-promised/
  await expect(
    contractAsOtherAccount.write.vote([BigInt(proposalIdx)])
  ).to.not.be.rejectedWith();
};

const delegateFixture = async (publicClient: PublicClient, ballotContract: any, fromAddress: string, toAddress: string) => {
  // Delegator should have the right to vote
  let delegator = await ballotContract.read.voters([fromAddress]);
  const delegatorWeight: BigInt = delegator[VOTER_WEIGHT_IDX];
  // console.log("Ballot -> delegateFixture -> delegatorWeight", delegatorWeight);
  expect(delegatorWeight).to.eq(1n);
  // Target voter should have the right to vote
  let targetVoter = await ballotContract.read.voters([toAddress]);
  const targetWeight: BigInt = targetVoter[VOTER_WEIGHT_IDX];
  // console.log("Ballot -> delegateFixture -> targetWeight", targetWeight);
  expect(targetWeight).to.eq(1n);
  // Delegate to the target voter
  const txHash = await ballotContract.write.delegate([toAddress]);
  const receipt = await publicClient.getTransactionReceipt({ hash: txHash });
  // console.log("Ballot -> delegateFixture -> txHash", txHash, "receipt", receipt);
  expect(receipt.status).to.equal("success");
  // Get the updated weights for the target voter
  delegator = await ballotContract.read.voters([fromAddress]);
  targetVoter = await ballotContract.read.voters([toAddress]);
  // console.log("Ballot -> delegateFixture -> delegator", delegator, "targetVoter", targetVoter);
  expect(delegator[VOTER_VOTED_IDX]).to.eq(true);
  expect(delegator[VOTER_DELEGATED_IDX].toLowerCase()).to.eq(toAddress.toLowerCase());
  expect(targetVoter[VOTER_WEIGHT_IDX]).to.eq(2n);
};

describe(CONTRACT_NAME, async () => {
  describe("when the contract is deployed", async () => {
    it("has the provided proposals", async () => {
      const { ballotContract } = await loadFixture(deployContract);

      for (let index = 0; index < PROPOSALS.length; index++) {
        const proposal = await ballotContract.read.proposals([BigInt(index)]);
        // console.log("Ballot -> deployed -> proposals -> index", index, "proposal", proposal);
        expect(hexToString(proposal[PROPOSAL_NAME_IDX], { size: 32 })).to.eq(PROPOSALS[index]);
      }
    });

    it("has zero votes for all proposals", async () => {
      const { ballotContract } = await loadFixture(deployContract);
      for (let index = 0; index < PROPOSALS.length; index++) {
        const proposal = await ballotContract.read.proposals([BigInt(index)]);
        expect(proposal[PROPOSAL_VOTES_IDX]).to.eq(0n);
      }
    });

    it("sets the deployer address as chairperson", async () => {
      const { ballotContract, deployer } = await loadFixture(deployContract);
      const chairperson = await ballotContract.read.chairperson();
      const deployerAddress = deployer.account.address;
      // console.log("Ballot -> deployed -> chairperson -> chairperson", chairperson, "deployer", deployerAddress);
      expect(chairperson.toLowerCase()).to.eq(deployerAddress);
    });

    it("sets the voting weight for the chairperson as 1", async () => {
      const { ballotContract } = await loadFixture(deployContract);
      const chairperson = await ballotContract.read.chairperson();
      const chairpersonVoter = await ballotContract.read.voters([chairperson]);
      console.log("Ballot -> deployed -> voting weights -> chairpersonVoter", chairpersonVoter);
      expect(chairpersonVoter[VOTER_WEIGHT_IDX]).to.eq(1n);
    });
  });

  describe("when the chairperson interacts with the giveRightToVote function in the contract", async () => {
    it("gives right to vote for another address", async () => {
      const { publicClient, ballotContract, deployer, otherAddress } = await loadFixture(deployContract);
      // Grant right to vote
      await giveRightToVoteFixture(publicClient, ballotContract, otherAddress);
    });

    it("can not give right to vote for someone that has voted", async () => {
      const { publicClient, ballotContract, otherAccount, otherAddress } = await loadFixture(deployContract);
      // Grant right to vote
      await giveRightToVoteFixture(publicClient, ballotContract, otherAddress);
      // Make voter vote
      await voteFixture(ballotContract, 0, otherAccount);
      // Assign to same voter again and expect error.
      await expect(
        ballotContract.write.giveRightToVote([otherAddress])
      ).to.be.rejectedWith("The voter already voted.");
    });

    it("can not give right to vote for someone that has already voting rights", async () => {
      const { publicClient, ballotContract, otherAddress } = await loadFixture(deployContract);
      // Grant right to vote
      await giveRightToVoteFixture(publicClient, ballotContract, otherAddress);
      // Assign to same voter again and expect error.
      await expect(
        ballotContract.write.giveRightToVote([otherAddress])
      ).to.be.rejectedWith();
    });
  });

  describe("when the voter interacts with the vote function in the contract", async () => {
    it("should register the vote", async () => {
      const {publicClient, ballotContract, otherAccount, otherAddress} = await loadFixture(deployContract);
      // Grant right to vote
      await giveRightToVoteFixture(publicClient, ballotContract, otherAddress);
      // Make voter vote
      const projectIdx = 0;
      await voteFixture(ballotContract, projectIdx, otherAccount);
      // Check that the vote was registered correctly.
      const proposal = await ballotContract.read.proposals([BigInt(projectIdx)]);
      expect(proposal[PROPOSAL_VOTES_IDX]).to.eq(1n);
    });
  });

  describe("when the voter interacts with the delegate function in the contract", async () => {
    // TODO
    it("should transfer voting power", async () => {
      const {publicClient, ballotContract, deployerAddress, otherAddress} = await loadFixture(deployContract);
      // Grant right to vote
      await giveRightToVoteFixture(publicClient, ballotContract, otherAddress);
      // Delegate to target voter
      await delegateFixture(publicClient, ballotContract, deployerAddress, otherAddress);
    });
  });

  describe("when an account other than the chairperson interacts with the giveRightToVote function in the contract", async () => {
    // TODO
    it("should revert", async () => {
      throw Error("Not implemented");
    });
  });

  describe("when an account without right to vote interacts with the vote function in the contract", async () => {
    // TODO
    it("should revert", async () => {
      throw Error("Not implemented");
    });
  });

  describe("when an account without right to vote interacts with the delegate function in the contract", async () => {
    // TODO
    it("should revert", async () => {
      throw Error("Not implemented");
    });
  });

  describe("when someone interacts with the winningProposal function before any votes are cast", async () => {
    // TODO
    it("should return 0", async () => {
      throw Error("Not implemented");
    });
  });

  describe("when someone interacts with the winningProposal function after one vote is cast for the first proposal", async () => {
    // TODO
    it("should return 0", async () => {
      throw Error("Not implemented");
    });
  });

  describe("when someone interacts with the winnerName function before any votes are cast", async () => {
    // TODO
    it("should return name of proposal 0", async () => {
      throw Error("Not implemented");
    });
  });

  describe("when someone interacts with the winnerName function after one vote is cast for the first proposal", async () => {
    // TODO
    it("should return name of proposal 0", async () => {
      throw Error("Not implemented");
    });
  });

  describe("when someone interacts with the winningProposal function and winnerName after 5 random votes are cast for the proposals", async () => {
    // TODO
    it("should return the name of the winner proposal", async () => {
      throw Error("Not implemented");
    });
  });
});
