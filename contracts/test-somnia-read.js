// Test reading from Somnia Streams
require('dotenv').config();
const { createPublicClient, http } = require('viem');

const RPC_URL = process.env.SOMNIA_RPC_URL;
const SOMNIA_STREAM_WRITER = process.env.SOMNIA_STREAM_WRITER;
const SCHEMA_ID = process.env.SOMNIA_SCHEMA_ID;
const DATA_KEY = '0x587b796735575e7ecf906cc71ac7ff1c8251aa0bcbe92c1f5593dc15f6276bf0'; // From test write

async function testSomniaRead() {
  console.log(' Testing read from Somnia Streams...\n');

  const client = createPublicClient({
    transport: http(RPC_URL, { timeout: 60000 })
  });

  try {
    console.log(' Calling somniaStream.get()...');
    console.log('  Schema ID:', SCHEMA_ID);
    console.log('  Data Key:', DATA_KEY);
    console.log();
    
    const data = await client.readContract({
      address: SOMNIA_STREAM_WRITER,
      abi: [{
        name: 'get',
        type: 'function',
        stateMutability: 'view',
        inputs: [
          { name: 'schemaId', type: 'bytes32' },
          { name: 'dataKey', type: 'bytes32' }
        ],
        outputs: [{ name: 'data', type: 'bytes' }]
      }],
      functionName: 'get',
      args: [SCHEMA_ID, DATA_KEY]
    });

    console.log(' Read succeeded!');
    console.log('Data length:', data.length, 'bytes');
    
    if (data === '0x' || data.length === 2) {
      console.log('  No data found (empty response)');
      console.log('This is expected if no data has been written yet.');
    } else {
      console.log(' Data exists!');
      console.log('Data:', data);
    }
    
  } catch (error) {
    console.error(' Error reading from Somnia Streams:', error.message);
  }
}

testSomniaRead();
