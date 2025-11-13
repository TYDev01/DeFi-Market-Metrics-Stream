// Note: These pairs must match what's initialized in the MetricsUpdater contract
// Currently only SOM-USDT is initialized (see contracts/.env PAIR0_*)
export const TRACKED_PAIRS = [
  {
    baseToken: "SOM",
    quoteToken: "USDT",
    baseAddress: "0x0000000000000000000000000000000000000001",
    quoteAddress: "0x0000000000000000000000000000000000000002",
    pairId: "SOM-USDT",
    source: "Chainlink",
    feed: "0xaEAa92c38939775d3be39fFA832A92611f7D6aDe"
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
