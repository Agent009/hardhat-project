import * as dotenv from "dotenv";
dotenv.config();

export const constants = Object.freeze({
  account: {
    deployerMemonic: process.env.MNEMONIC || "",
    deployerAddress: process.env.DEPLOYER_ADDRESS || "",
    deployerPrivateKey: process.env.PRIVATE_KEY || "",
  },
  contracts: {
    ballot: {
      sepolia: process.env.BALLOT_SEPOLIA || "",
    },
  },
  integrations: {
    alchemy: {
      apiKey: process.env.ALCHEMY_API_KEY || "",
    },
    etherscan: {
      apiKey: process.env.ETHERSCAN_API_KEY || "",
    },
    infura: {
      apiKey: process.env.INFURA_API_KEY || "",
      apiSecret: process.env.INFURA_API_SECRET || "",
    },
    pokt: {
      apiKey: process.env.POKT_API_KEY || "",
    },
  },
});
