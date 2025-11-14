// Multiple pairs configured for price tracking via Chainlink
// Feeds can be from any network - prices are fetched off-chain and published to Somnia
export const TRACKED_PAIRS = [
  {
    baseToken: "SOM",
    quoteToken: "USDT",
    baseAddress: "0x0000000000000000000000000000000000000001",
    quoteAddress: "0x0000000000000000000000000000000000000002",
    pairId: "SOM-USDT",
    source: "Chainlink",
    feed: "0xaEAa92c38939775d3be39fFA832A92611f7D6aDe",
    network: "somnia", // Somnia Dream testnet
    rpcUrl: "https://dream-rpc.somnia.network"
  },
  {
    baseToken: "ETH",
    quoteToken: "USD",
    baseAddress: "0x0000000000000000000000000000000000000003",
    quoteAddress: "0x0000000000000000000000000000000000000004",
    pairId: "ETH-USD",
    source: "Chainlink",
    feed: "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419", // Ethereum Mainnet
    network: "ethereum",
    rpcUrl: "https://eth.llamarpc.com" // Public RPC
  },
  {
    baseToken: "BTC",
    quoteToken: "USD",
    baseAddress: "0x0000000000000000000000000000000000000005",
    quoteAddress: "0x0000000000000000000000000000000000000006",
    pairId: "BTC-USD",
    source: "Chainlink",
    feed: "0xF4030086522a5bEEa4988F8cA5B36dbC97BeE88c", // Ethereum Mainnet (checksummed)
    network: "ethereum",
    rpcUrl: "https://eth.llamarpc.com"
  },
  {
    baseToken: "LINK",
    quoteToken: "USD",
    baseAddress: "0x0000000000000000000000000000000000000007",
    quoteAddress: "0x0000000000000000000000000000000000000008",
    pairId: "LINK-USD",
    source: "Chainlink",
    feed: "0x2c1d072e956AFFC0D435Cb7AC38EF18d24d9127c", // Ethereum Mainnet
    network: "ethereum",
    rpcUrl: "https://eth.llamarpc.com"
  },
  {
    baseToken: "AAVE",
    quoteToken: "USD",
    baseAddress: "0x0000000000000000000000000000000000000009",
    quoteAddress: "0x000000000000000000000000000000000000000a",
    pairId: "AAVE-USD",
    source: "Chainlink",
    feed: "0x547a514d5e3769680Ce22B2361c10Ea13619e8a9", // Ethereum Mainnet
    network: "ethereum",
    rpcUrl: "https://eth.llamarpc.com"
  },
  {
    baseToken: "UNI",
    quoteToken: "USD",
    baseAddress: "0x000000000000000000000000000000000000000b",
    quoteAddress: "0x000000000000000000000000000000000000000c",
    pairId: "UNI-USD",
    source: "Chainlink",
    feed: "0x553303d460EE0afB37EdFf9bE42922D8FF63220e", // Ethereum Mainnet
    network: "ethereum",
    rpcUrl: "https://eth.llamarpc.com"
  },
  {
    baseToken: "MATIC",
    quoteToken: "USD",
    baseAddress: "0x000000000000000000000000000000000000000d",
    quoteAddress: "0x000000000000000000000000000000000000000e",
    pairId: "MATIC-USD",
    source: "Chainlink",
    feed: "0x7bAC85A8a13A4BcD8abb3eB7d6b4d632c5a57676", // Ethereum Mainnet
    network: "ethereum",
    rpcUrl: "https://eth.llamarpc.com"
  },
  {
    baseToken: "SOL",
    quoteToken: "USD",
    baseAddress: "0x000000000000000000000000000000000000000f",
    quoteAddress: "0x0000000000000000000000000000000000000010",
    pairId: "SOL-USD",
    source: "Chainlink",
    feed: "0x4ffC43a60e009B551865A93d232E33Fce9f01507", // Ethereum Mainnet
    network: "ethereum",
    rpcUrl: "https://eth.llamarpc.com"
  },
  {
    baseToken: "AVAX",
    quoteToken: "USD",
    baseAddress: "0x0000000000000000000000000000000000000011",
    quoteAddress: "0x0000000000000000000000000000000000000012",
    pairId: "AVAX-USD",
    source: "Chainlink",
    feed: "0xFF3EEb22B5E3dE6e705b44749C2559d704923FD7", // Ethereum Mainnet
    network: "ethereum",
    rpcUrl: "https://eth.llamarpc.com"
  }
];

// Total: 9 pairs tracked (SOM, ETH, BTC, LINK, AAVE, UNI, MATIC, SOL, AVAX)
// 1. Find Chainlink feed addresses for Somnia network
// 2. Run: node add-chainlink-pairs.js (update addresses in that file first)
// 3. Add the pairs here to match
// 
// Example additional pairs (need correct Somnia Chainlink addresses):
// {
//   baseToken: "ETH",
//   quoteToken: "USD",
//   baseAddress: "0x0000000000000000000000000000000000000003",
//   quoteAddress: "0x0000000000000000000000000000000000000004",
//   pairId: "ETH-USD",
//   source: "Chainlink",
//   feed: "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419" // This is Ethereum mainnet - need Somnia equivalent
// }
