// Update prices using Somnia SDK (proper way)
import 'dotenv/config';
import { createPublicClient, createWalletClient, defineChain, http, encodeAbiParameters, parseAbiParameters, keccak256 } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { SDK, SchemaEncoder } from "@somnia-chain/streams";

const CONTRACT_ADDRESS = process.env.METRICS_UPDATER_ADDRESS!;
const rpcUrl = process.env.SOMNIA_RPC_URL!;
const privateKey = process.env.PRIVATE_KEY!;

// Schema matching MetricsUpdater.sol
const priceSchema = "uint64 timestamp, string baseSymbol, string quoteSymbol, string pairId, string source, uint256 price, int256 delta, int256 deltaBps, address priceFeed, uint8 feedDecimals, address baseToken, address quoteToken";

async function updatePrices() {
  console.log('Updating prices using Somnia SDK...\n');

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

  // Fetch price from contract (simulate what contract does)
  const CHAINLINK_FEED = '0xaEAa92c38939775d3be39fFA832A92611f7D6aDe';
  
  const roundData = await publicClient.readContract({
    address: CHAINLINK_FEED,
    abi: [{
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
    }],
    functionName: 'latestRoundData'
  });

  const price = BigInt(roundData[1]);
  console.log('Fetched price:', price.toString(), '($', (Number(price) / 1e8).toFixed(8), ')');

  // Encode data
  const timestamp = BigInt(Math.floor(Date.now() / 1000));
  const encodedData = schemaEncoder.encodeData([
    { name: "timestamp", value: timestamp.toString(), type: "uint64" },
    { name: "baseSymbol", value: "SOM", type: "string" },
    { name: "quoteSymbol", value: "USDT", type: "string" },
    { name: "pairId", value: "SOM-USDT", type: "string" },
    { name: "source", value: "Chainlink", type: "string" },
    { name: "price", value: price.toString(), type: "uint256" },
    { name: "delta", value: "0", type: "int256" },
    { name: "deltaBps", value: "0", type: "int256" },
    { name: "priceFeed", value: CHAINLINK_FEED, type: "address" },
    { name: "feedDecimals", value: "8", type: "uint8" },
    { name: "baseToken", value: "0x0000000000000000000000000000000000000001", type: "address" },
    { name: "quoteToken", value: "0x0000000000000000000000000000000000000002", type: "address" }
  ]);

  // Data key (unique identifier)
  const dataKey = keccak256(
    encodeAbiParameters(
      parseAbiParameters('address, address, string'),
      [
        '0x0000000000000000000000000000000000000001',
        '0x0000000000000000000000000000000000000002',
        'SOM-USDT'
      ]
    )
  );

  console.log('Data Key:', dataKey);
  console.log();

  try {
    console.log('Publishing to Somnia Streams...');
    const txHash = await sdk.streams.set([{
      id: dataKey,
      schemaId: schemaId!,
      data: encodedData,
    }]);

    console.log('Transaction sent!');
    console.log('Hash:', txHash);
    console.log();
    console.log('Price data published successfully!');
    console.log('Check the dashboard for live data.');
    
  } catch (error: any) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

updatePrices();
