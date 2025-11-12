// Read price data using SDK
import 'dotenv/config';
import { createPublicClient, createWalletClient, defineChain, http, keccak256, encodeAbiParameters, parseAbiParameters } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { SDK, SchemaEncoder } from "@somnia-chain/streams";

const rpcUrl = process.env.SOMNIA_RPC_URL!;
const privateKey = process.env.PRIVATE_KEY!;
const publisherAddress = process.env.OWNER_ADDRESS!;

const priceSchema = "uint64 timestamp, string baseSymbol, string quoteSymbol, string pairId, string source, uint256 price, int256 delta, int256 deltaBps, address priceFeed, uint8 feedDecimals, address baseToken, address quoteToken";

async function readPrices() {
  console.log('Reading prices from Somnia Streams...\n');

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

  const schemaId = await sdk.streams.computeSchemaId(priceSchema);
  console.log('Schema ID:', schemaId);

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
  console.log('Publisher:', publisherAddress);
  console.log();

  try {
    const data = await sdk.streams.getByKey(
      schemaId!,
      publisherAddress as `0x${string}`,
      dataKey
    );

    if (data) {
      console.log('Data found!');
      console.log(JSON.stringify(data, (key, value) =>
        typeof value === 'bigint' ? value.toString() : value
      , 2));
      
      // Display key fields
      if (typeof data === 'object' && data !== null) {
        const d = data as any;
        console.log('\nPrice Data:');
        console.log('  Pair:', d.baseSymbol, '/', d.quoteSymbol);
        console.log('  Price:', d.price ? (Number(d.price) / 1e8).toFixed(8) : 'N/A');
        console.log('  Source:', d.source);
        console.log('  Timestamp:', d.timestamp ? new Date(Number(d.timestamp) * 1000).toISOString() : 'N/A');
      }
    } else {
      console.log('No data found');
    }
    
  } catch (error: any) {
    console.error('Error:', error.message);
  }
}

readPrices();
