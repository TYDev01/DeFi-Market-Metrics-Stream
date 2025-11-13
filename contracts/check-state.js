// Script to check contract state and debug the issue
require('dotenv').config();
const { createPublicClient, http } = require('viem');

const RPC_URL = process.env.SOMNIA_RPC_URL;
const CONTRACT_ADDRESS = process.env.METRICS_UPDATER_ADDRESS;
const SOMNIA_STREAM_WRITER = '0x6AB397FF662e42312c003175DCD76EfF69D048Fc';

async function checkState() {
  console.log(' Checking contract state...\n');

  const client = createPublicClient({
    transport: http(RPC_URL, { timeout: 60000 })
  });

  // Check owner
  const owner = await client.readContract({
    address: CONTRACT_ADDRESS,
    abi: [{
      name: 'owner',
      type: 'function',
      stateMutability: 'view',
      inputs: [],
      outputs: [{ type: 'address' }]
    }],
    functionName: 'owner'
  });
  console.log('Owner:', owner);

  // Check somniaStream address
  const somniaStream = await client.readContract({
    address: CONTRACT_ADDRESS,
    abi: [{
      name: 'somniaStream',
      type: 'function',
      stateMutability: 'view',
      inputs: [],
      outputs: [{ type: 'address' }]
    }],
    functionName: 'somniaStream'
  });
  console.log('Somnia Stream:', somniaStream);
  console.log('Expected:', SOMNIA_STREAM_WRITER);
  console.log('Match:', somniaStream.toLowerCase() === SOMNIA_STREAM_WRITER.toLowerCase());

  // Check schemaId
  const schemaId = await client.readContract({
    address: CONTRACT_ADDRESS,
    abi: [{
      name: 'schemaId',
      type: 'function',
      stateMutability: 'view',
      inputs: [],
      outputs: [{ type: 'bytes32' }]
    }],
    functionName: 'schemaId'
  });
  console.log('Schema ID:', schemaId);

  // Check interval
  const interval = await client.readContract({
    address: CONTRACT_ADDRESS,
    abi: [{
      name: 'interval',
      type: 'function',
      stateMutability: 'view',
      inputs: [],
      outputs: [{ type: 'uint32' }]
    }],
    functionName: 'interval'
  });
  console.log('Interval:', interval, 'seconds (', interval / 60, 'minutes )');

  // Check lastUpkeepTimestamp
  const lastUpkeep = await client.readContract({
    address: CONTRACT_ADDRESS,
    abi: [{
      name: 'lastUpkeepTimestamp',
      type: 'function',
      stateMutability: 'view',
      inputs: [],
      outputs: [{ type: 'uint64' }]
    }],
    functionName: 'lastUpkeepTimestamp'
  });
  console.log('Last Upkeep Timestamp:', lastUpkeep);
  console.log('Current block timestamp: ~', Math.floor(Date.now() / 1000));
  console.log('Time since last upkeep:', Math.floor(Date.now() / 1000) - Number(lastUpkeep), 'seconds');

  //Check if Stream Writer exists
  const code = await client.getBytecode({address: SOMNIA_STREAM_WRITER});
  console.log('\nSomnia Stream Writer bytecode length:', code ? code.length : 0);
  console.log('Writer exists:', !!code && code !== '0x');
}

checkState().catch(console.error);
