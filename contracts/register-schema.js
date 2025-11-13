// Simple schema registration script without Somnia SDK
require('dotenv').config();
const { createWalletClient, createPublicClient, http, keccak256, toHex } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');

const RPC_URL = process.env.SOMNIA_RPC_URL;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const SOMNIA_STREAM_WRITER = process.env.SOMNIA_STREAM_WRITER;

// Schema that matches MetricsUpdater.sol encoding
const schemaString = "uint64 timestamp, string baseSymbol, string quoteSymbol, string pairId, string source, uint256 price, int256 delta, int256 deltaBps, address priceFeed, uint8 feedDecimals, address baseToken, address quoteToken";

async function registerSchema() {
  console.log(' Registering Price Metrics Schema...\n');
  
  const schemaId = keccak256(toHex(schemaString));
  console.log('Schema String:', schemaString);
  console.log('Computed Schema ID:', schemaId);
  console.log('Expected from .env:', process.env.SOMNIA_SCHEMA_ID);
  console.log('Match:', schemaId === process.env.SOMNIA_SCHEMA_ID, '\n');

  const account = privateKeyToAccount(PRIVATE_KEY.startsWith('0x') ? PRIVATE_KEY : `0x${PRIVATE_KEY}`);
  
  const walletClient = createWalletClient({
    account,
    transport: http(RPC_URL, { timeout: 120000 })
  });

  const publicClient = createPublicClient({
    transport: http(RPC_URL, { timeout: 120000 })
  });

  try {
    // Call registerDataSchemas function on Somnia Stream Writer
    // Function signature: registerDataSchemas((string id, string schema)[] schemas, bool allowOverwrite)
    const hash = await walletClient.writeContract({
      address: SOMNIA_STREAM_WRITER,
      abi: [{
        name: 'registerDataSchemas',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [
          {
            name: 'schemas',
            type: 'tuple[]',
            components: [
              { name: 'id', type: 'string' },
              { name: 'schema', type: 'string' }
            ]
          },
          { name: 'allowOverwrite', type: 'bool' }
        ],
        outputs: []
      }],
      functionName: 'registerDataSchemas',
      args: [
        [{ id: 'PriceMetrics', schema: schemaString }],
        true  // allow overwrite
      ],
      gas: 2000000n,
      gasPrice: 50000000000n
    });

    console.log(' Schema registration transaction sent!');
    console.log('Hash:', hash);
    console.log('\n Waiting for confirmation...');

    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    
    if (receipt.status === 'success') {
      console.log(' Schema registered successfully!');
      console.log('Block:', receipt.blockNumber.toString());
      console.log('\n You can now trigger price updates!');
      console.log('Run: node manual-update.js');
    } else {
      console.log(' Schema registration failed');
      console.log('Transaction reverted');
    }
    
  } catch (error) {
    console.error(' Error:', error.message);
    
    if (error.message.includes('already registered')) {
      console.log('\n Schema might already be registered. Try triggering an update anyway.');
      console.log('Run: node manual-update.js');
    }
  }
}

registerSchema();
