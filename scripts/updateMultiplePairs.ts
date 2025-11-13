// Update multiple pairs using Somnia SDK
import 'dotenv/config';
import { createPublicClient, createWalletClient, defineChain, http, encodeAbiParameters, parseAbiParameters, keccak256 } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { SDK, SchemaEncoder } from "@somnia-chain/streams";
import { TRACKED_PAIRS } from '../shared/pairs.js';

const rpcUrl = process.env.SOMNIA_RPC_URL!;
const privateKey = process.env.PRIVATE_KEY!;

// Schema matching MetricsUpdater.sol
const priceSchema = "uint64 timestamp, string baseSymbol, string quoteSymbol, string pairId, string source, uint256 price, int256 delta, int256 deltaBps, address priceFeed, uint8 feedDecimals, address baseToken, address quoteToken";

// Chainlink ABI for price feeds
const CHAINLINK_ABI = [{
  name: 'latestRoundData',
  type: 'function',
  stateMutability: 'view',
  inputs: [],
  outputs: [
    { name: 'roundId', type: 'uint80' },
    { name: 'answer', type: 'int256' },
    { name: 'startedAt', type: 'uint256' },
    { name: 'updatedAt', type: 'uint256' },
    { name: 'answeredInRound', type: 'uint80' }
  ]
}, {
  name: 'decimals',
  type: 'function',
  stateMutability: 'view',
  inputs: [],
  outputs: [{ type: 'uint8' }]
}];

async function updateMultiplePairs() {
  console.log('Updating multiple pairs using Somnia SDK...\n');

  const chainId = 50312;
  const chain = defineChain({
    id: chainId,
    name: "Somnia Dream",
    network: "somnia-dream",
    nativeCurrency: { decimals: 18, name: "Somnia", symbol: "SOM" },
    rpcUrls: {
      default: { http: [rpcUrl] },
      public: { http: [rpcUrl] }
    }
  });

  const transport = http(rpcUrl, { timeout: 120000 });
  const account = privateKeyToAccount(privateKey.startsWith("0x") ? (privateKey as `0x${string}`) : (`0x${privateKey}` as `0x${string}`));

  const publicClient = createPublicClient({ chain, transport });
  const walletClient = createWalletClient({ account, chain, transport });
  const sdk = new SDK({ public: publicClient, wallet: walletClient });

  // Compute schema ID
  const schemaId = await sdk.streams.computeSchemaId(priceSchema);
  console.log('Schema ID:', schemaId);
  console.log();

  // Create encoder
  const schemaEncoder = new SchemaEncoder(priceSchema);

  const dataToPublish = [];
  const timestamp = BigInt(Math.floor(Date.now() / 1000));

  // Process each pair
  for (const pair of TRACKED_PAIRS) {
    console.log(`Processing ${pair.pairId}...`);
    console.log(`  Network: ${pair.network}`);
    console.log(`  Feed: ${pair.feed}`);

    // Skip if feed address is zero (not configured)
    if (pair.feed === '0x0000000000000000000000000000000000000000') {
      console.log(`  Skipped: No Chainlink feed configured`);
      console.log();
      continue;
    }

    try {
      // Create client for the specific network this pair uses
      const pairRpcUrl = pair.rpcUrl || rpcUrl;
      const pairClient = createPublicClient({
        transport: http(pairRpcUrl, { timeout: 120000 })
      });

      // Get decimals
      const decimals = await pairClient.readContract({
        address: pair.feed as `0x${string}`,
        abi: CHAINLINK_ABI,
        functionName: 'decimals'
      }) as number;

      // Fetch price from Chainlink
      const roundData = await pairClient.readContract({
        address: pair.feed as `0x${string}`,
        abi: CHAINLINK_ABI,
        functionName: 'latestRoundData'
      }) as [bigint, bigint, bigint, bigint, bigint];

      const price = BigInt(roundData[1]);
      const updatedAt = Number(roundData[3]);
      const now = Math.floor(Date.now() / 1000);
      const age = now - updatedAt;
      
      const formattedPrice = (Number(price) / Math.pow(10, Number(decimals))).toFixed(8);
      
      console.log(`  Price: $${formattedPrice}`);
      console.log(`  Decimals: ${decimals}`);
      console.log(`  Age: ${Math.floor(age / 60)} minutes`);

      // Calculate data key to fetch previous price
      const dataKey = keccak256(
        encodeAbiParameters(
          parseAbiParameters('address, address, string'),
          [
            pair.baseAddress as `0x${string}`,
            pair.quoteAddress as `0x${string}`,
            pair.pairId
          ]
        )
      );

      // Fetch previous price from Somnia Streams to calculate delta
      let delta = BigInt(0);
      let deltaBps = BigInt(0);
      
      try {
        const previousData = await sdk.streams.getByKey(
          schemaId!,
          account.address,
          dataKey
        );

        if (previousData && Array.isArray(previousData) && previousData.length > 0) {
          const fields = previousData[0];
          if (Array.isArray(fields)) {
            const prevPriceField = fields.find((f: any) => f.name === 'price');
            if (prevPriceField?.value?.value) {
              const previousPrice = BigInt(prevPriceField.value.value);
              delta = price - previousPrice;
              
              // Calculate basis points (0.01% = 1 bp)
              if (previousPrice > 0) {
                deltaBps = (delta * BigInt(10000)) / previousPrice;
              }
              
              const deltaFormatted = (Number(delta) / Math.pow(10, Number(decimals))).toFixed(8);
              const deltaBpsFormatted = (Number(deltaBps) / 100).toFixed(2);
              console.log(`  Change: ${delta >= 0 ? '+' : ''}${deltaFormatted} (${delta >= 0 ? '+' : ''}${deltaBpsFormatted}%)`);
            }
          }
        }
      } catch (error: any) {
        // First time publishing this pair, delta will be 0
        console.log(`  Change: No previous data (first update)`);
      }

      // Encode data for this pair
      const encodedData = schemaEncoder.encodeData([
        { name: "timestamp", value: timestamp.toString(), type: "uint64" },
        { name: "baseSymbol", value: pair.baseToken, type: "string" },
        { name: "quoteSymbol", value: pair.quoteToken, type: "string" },
        { name: "pairId", value: pair.pairId, type: "string" },
        { name: "source", value: pair.source, type: "string" },
        { name: "price", value: price.toString(), type: "uint256" },
        { name: "delta", value: delta.toString(), type: "int256" },
        { name: "deltaBps", value: deltaBps.toString(), type: "int256" },
        { name: "priceFeed", value: pair.feed as string, type: "address" },
        { name: "feedDecimals", value: decimals.toString(), type: "uint8" },
        { name: "baseToken", value: pair.baseAddress as string, type: "address" },
        { name: "quoteToken", value: pair.quoteAddress as string, type: "address" }
      ]);

      // Use the dataKey we already calculated above
      dataToPublish.push({
        id: dataKey,
        schemaId: schemaId!,
        data: encodedData,
        pairId: pair.pairId
      });

      console.log(`  Data Key: ${dataKey}`);
      console.log(`  Ready for publication`);
      console.log();

    } catch (error: any) {
      console.log(`  Error: ${error.message}`);
      console.log(`  Skipped`);
      console.log();
    }
  }

  // Publish all pairs in a single transaction
  if (dataToPublish.length === 0) {
    console.log('No data to publish. Configure Chainlink feeds in shared/pairs.js');
    return;
  }

  console.log(`\nPublishing ${dataToPublish.length} pair(s) to Somnia Streams...`);
  
  try {
    const txHash = await sdk.streams.set(dataToPublish.map(d => ({
      id: d.id,
      schemaId: d.schemaId,
      data: d.data
    })));

    console.log('Transaction sent!');
    console.log('Hash:', txHash);
    console.log();
    console.log('Price data published successfully!');
    console.log('Pairs updated:', dataToPublish.map(d => d.pairId).join(', '));
    console.log('Check the dashboard for live data.');
    
  } catch (error: any) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

updateMultiplePairs();
