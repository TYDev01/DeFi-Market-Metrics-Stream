// Check if schema ID matches what the contract expects
require('dotenv').config();
const { keccak256, toHex } = require('viem');

// Schema that MetricsUpdater.sol encodes
const contractSchema = "uint64 timestamp, string baseSymbol, string quoteSymbol, string pairId, string source, uint256 price, int256 delta, int256 deltaBps, address priceFeed, uint8 feedDecimals, address baseToken, address quoteToken";

// Schema from original setupSomnia.ts
const originalSchema = "uint64 timestamp, string protocol, string network, string poolId, string baseToken, string quoteToken, uint256 tvlUsd, uint256 volume24hUsd, uint256 fees24hUsd, int256 aprBps";

const contractSchemaId = keccak256(toHex(contractSchema));
const originalSchemaId = keccak256(toHex(originalSchema));

console.log("Contract Schema:");
console.log(contractSchema);
console.log("Computed ID:", contractSchemaId);
console.log();
console.log("Original Schema:");
console.log(originalSchema);
console.log("Computed ID:", originalSchemaId);
console.log();
console.log("Expected from .env:", process.env.SOMNIA_SCHEMA_ID);
console.log();
console.log("Contract schema matches .env?", contractSchemaId === process.env.SOMNIA_SCHEMA_ID);
console.log("Original schema matches .env?", originalSchemaId === process.env.SOMNIA_SCHEMA_ID);
