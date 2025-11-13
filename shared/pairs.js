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
  }
];

// To add more pairs like ETH/USD, BTC/USD, LINK/USD:
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
