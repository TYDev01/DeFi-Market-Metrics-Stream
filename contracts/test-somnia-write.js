// Test writing directly to Somnia Streams
require('dotenv').config();
const { createWalletClient, http, keccak256, encodeAbiParameters, parseAbiParameters } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');

const RPC_URL = process.env.SOMNIA_RPC_URL;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const SOMNIA_STREAM_WRITER = process.env.SOMNIA_STREAM_WRITER;
const SCHEMA_ID = process.env.SOMNIA_SCHEMA_ID;

async function testSomniaWrite() {
  console.log(' Testing direct write to Somnia Streams...\n');

  const account = privateKeyToAccount(PRIVATE_KEY.startsWith('0x') ? PRIVATE_KEY : `0x${PRIVATE_KEY}`);
  
  const walletClient = createWalletClient({
    account,
    transport: http(RPC_URL, { timeout: 120000 })
  });

  // Create test data matching the schema
  const testData = {
    timestamp: BigInt(Math.floor(Date.now() / 1000)),
    baseSymbol: 'SOM',
    quoteSymbol: 'USDT',
    pairId: 'SOM-USDT-TEST',
    source: 'Test',
    price: 38000000n, // $0.38
    delta: 0n,
    deltaBps: 0n,
    priceFeed: '0xaEAa92c38939775d3be39fFA832A92611f7D6aDe',
    feedDecimals: 8,
    baseToken: '0x0000000000000000000000000000000000000001',
    quoteToken: '0x0000000000000000000000000000000000000002'
  };

  // Encode the data
  const encodedData = encodeAbiParameters(
    parseAbiParameters('uint64, string, string, string, string, uint256, int256, int256, address, uint8, address, address'),
    [
      testData.timestamp,
      testData.baseSymbol,
      testData.quoteSymbol,
      testData.pairId,
      testData.source,
      testData.price,
      testData.delta,
      testData.deltaBps,
      testData.priceFeed,
      testData.feedDecimals,
      testData.baseToken,
      testData.quoteToken
    ]
  );

  // Compute data key (same way contract does)
  const dataKey = keccak256(
    encodeAbiParameters(
      parseAbiParameters('address, address, string'),
      [testData.baseToken, testData.quoteToken, testData.pairId]
    )
  );

  console.log(' Test Data:');
  console.log('  Schema ID:', SCHEMA_ID);
  console.log('  Data Key:', dataKey);
  console.log('  Price:', testData.price.toString());
  console.log('  Encoded Data Length:', encodedData.length, 'bytes');
  console.log();

  try {
    console.log(' Calling somniaStream.set()...');
    
    const hash = await walletClient.writeContract({
      address: SOMNIA_STREAM_WRITER,
      abi: [{
        name: 'set',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [
          { name: 'schemaId', type: 'bytes32' },
          { name: 'dataKey', type: 'bytes32' },
          { name: 'encodedData', type: 'bytes' }
        ],
        outputs: []
      }],
      functionName: 'set',
      args: [SCHEMA_ID, dataKey, encodedData],
      gas: 1000000n,
      gasPrice: 50000000000n
    });

    console.log(' Transaction sent!');
    console.log('Hash:', hash);
    console.log('\n Waiting for confirmation...');

    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    console.log('\n If this succeeds, Somnia Streams is working!');
    console.log('The issue would be in the contract logic, not Somnia Streams.');
    
  } catch (error) {
    console.error('\n Error writing to Somnia Streams:', error.message);
    console.log('\nPossible issues:');
    console.log('1. Schema not properly registered for this address');
    console.log('2. Permissions/access control on Somnia Streams');
    console.log('3. Schema ID mismatch');
    console.log('4. Data encoding issue');
  }
}

testSomniaWrite();
