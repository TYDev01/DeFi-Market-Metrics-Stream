// Test Chainlink feed directly
require('dotenv').config();
const { createPublicClient, http } = require('viem');

const RPC_URL = process.env.SOMNIA_RPC_URL;
const CHAINLINK_FEED = '0xaEAa92c38939775d3be39fFA832A92611f7D6aDe'; // SOM/USDT

async function testChainlinkFeed() {
  console.log('Testing Chainlink Feed...\n');
  console.log('Feed Address:', CHAINLINK_FEED);
  console.log();

  const client = createPublicClient({
    transport: http(RPC_URL, { timeout: 60000 })
  });

  try {
    // Test 1: Get decimals
    console.log('Test 1: Getting decimals...');
    const decimals = await client.readContract({
      address: CHAINLINK_FEED,
      abi: [{
        name: 'decimals',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ type: 'uint8' }]
      }],
      functionName: 'decimals'
    });
    console.log('Decimals:', decimals);
    console.log();

    // Test 2: Get latest round data
    console.log('Test 2: Getting latestRoundData...');
    const roundData = await client.readContract({
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
    
    console.log('Round Data:');
    console.log('  Round ID:', roundData[0].toString());
    console.log('  Answer (price):', roundData[1].toString());
    console.log('  Started At:', new Date(Number(roundData[2]) * 1000).toISOString());
    console.log('  Updated At:', new Date(Number(roundData[3]) * 1000).toISOString());
    console.log('  Answered In Round:', roundData[4].toString());
    console.log();

    // Check if price is valid
    const price = BigInt(roundData[1]);
    if (price <= 0n) {
      console.log('ERROR: Price is zero or negative!');
      console.log('This Chainlink feed may not be working properly on Somnia.');
      return;
    }

    // Check if data is stale
    const updatedAt = Number(roundData[3]);
    const now = Math.floor(Date.now() / 1000);
    const age = now - updatedAt;
    
    console.log('Data Age:', age, 'seconds (', Math.floor(age / 3600), 'hours )');
    
    if (age > 86400) { // More than 24 hours
      console.log('WARNING: Price data is stale (>24 hours old)');
      console.log('This feed may not be actively updated on Somnia testnet.');
    } else {
      console.log('Price data is relatively fresh');
    }
    console.log();

    // Test 3: Try calling the feed the way the contract does
    console.log('Test 3: Simulating contract call...');
    const result = await client.call({
      to: CHAINLINK_FEED,
      data: '0xfeaf968c' // latestRoundData() selector
    });
    console.log('Raw call succeeded');
    console.log();

    console.log('All tests passed!');
    console.log('The Chainlink feed is working correctly.');
    console.log('\nThe issue is likely NOT with Chainlink.');
    
  } catch (error) {
    console.error('Error testing Chainlink feed:', error.message);
    console.log('\nWARNING: The Chainlink feed may be the problem!');
    console.log('Possible issues:');
    console.log('1. Feed address is incorrect for Somnia network');
    console.log('2. Feed contract has different ABI');
    console.log('3. Feed is not deployed on Somnia testnet');
  }
}

testChainlinkFeed();
