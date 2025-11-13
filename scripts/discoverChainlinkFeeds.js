// Script to discover available Chainlink price feeds on Somnia network
require('dotenv').config();
const { createPublicClient, http } = require('viem');

const RPC_URL = process.env.SOMNIA_RPC_URL;

// Common Chainlink feed addresses to test
// These are well-known Chainlink feed addresses from various networks
const POTENTIAL_FEEDS = [
  // ETH/USD feeds from different networks
  { pair: 'ETH/USD', addresses: [
    '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419', // Ethereum Mainnet
    '0x694AA1769357215DE4FAC081bf1f309aDC325306', // Sepolia
    '0x143db3CEEfbdfe5631aDD3E50f7614B6ba708BA7', // Arbitrum
  ]},
  // BTC/USD feeds
  { pair: 'BTC/USD', addresses: [
    '0xF4030086522a5bEEa4988F8cA5B36dbC97BeE88c', // Ethereum Mainnet
    '0x1b44F3514812d835EB1BDB0acB33d3fA3351Ee43', // Sepolia
    '0x6ce185860a4963106506C203335A2910413708e9', // Arbitrum
  ]},
  // LINK/USD feeds
  { pair: 'LINK/USD', addresses: [
    '0x2c1d072e956AFFC0D435Cb7AC38EF18d24d9127c', // Ethereum Mainnet
    '0xc59E3633BAAC79493d908e63626716e204A45EdF', // Sepolia
    '0x86E53CF1B870786351Da77A57575e79CB55812CB', // Arbitrum
  ]},
  // Additional common pairs
  { pair: 'USDT/USD', addresses: [
    '0x3E7d1eAB13ad0104d2750B8863b489D65364e32D', // Ethereum Mainnet
  ]},
  { pair: 'USDC/USD', addresses: [
    '0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6', // Ethereum Mainnet
  ]},
];

async function checkFeed(client, address, pairName) {
  try {
    // Try to read decimals
    const decimals = await client.readContract({
      address,
      abi: [{
        name: 'decimals',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ type: 'uint8' }]
      }],
      functionName: 'decimals'
    });

    // Try to get latest round data
    const roundData = await client.readContract({
      address,
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
    const updatedAt = Number(roundData[3]);
    const now = Math.floor(Date.now() / 1000);
    const age = now - updatedAt;

    if (price > 0n) {
      const formattedPrice = (Number(price) / Math.pow(10, Number(decimals))).toFixed(8);
      console.log(`\nFOUND: ${pairName}`);
      console.log(`  Address: ${address}`);
      console.log(`  Decimals: ${decimals}`);
      console.log(`  Price: $${formattedPrice}`);
      console.log(`  Last Updated: ${Math.floor(age / 3600)} hours ago`);
      console.log(`  Status: ${age < 86400 ? 'ACTIVE' : 'STALE'}`);
      return { address, decimals, price: formattedPrice, age, active: age < 86400 };
    }
  } catch (error) {
    // Feed doesn't exist or doesn't work on this network
    return null;
  }
  return null;
}

async function discoverFeeds() {
  console.log('Discovering Chainlink Price Feeds on Somnia Network...\n');
  console.log('RPC:', RPC_URL);
  console.log('='.repeat(70));

  const client = createPublicClient({
    transport: http(RPC_URL, { timeout: 60000 })
  });

  const foundFeeds = [];

  for (const feedGroup of POTENTIAL_FEEDS) {
    console.log(`\nChecking ${feedGroup.pair} feeds...`);
    
    for (const address of feedGroup.addresses) {
      const result = await checkFeed(client, address, feedGroup.pair);
      if (result) {
        foundFeeds.push({ pair: feedGroup.pair, ...result });
      }
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('\nSUMMARY:');
  console.log('='.repeat(70));
  
  if (foundFeeds.length === 0) {
    console.log('\nNo Chainlink feeds found on Somnia network.');
    console.log('\nThis could mean:');
    console.log('1. Somnia uses different feed addresses (check Somnia docs)');
    console.log('2. Chainlink feeds are not deployed on this network yet');
    console.log('3. You need to deploy your own price feeds');
    console.log('\nNext steps:');
    console.log('- Check Somnia documentation for Chainlink feed addresses');
    console.log('- Contact Somnia team for available oracle feeds');
    console.log('- Consider using Somnia-specific price oracles');
  } else {
    console.log(`\nFound ${foundFeeds.length} working feed(s):\n`);
    
    foundFeeds.forEach((feed, i) => {
      console.log(`${i + 1}. ${feed.pair}`);
      console.log(`   Address: ${feed.address}`);
      console.log(`   Price: $${feed.price}`);
      console.log(`   Status: ${feed.active ? 'ACTIVE' : 'STALE'}`);
      console.log();
    });

    console.log('\nTo use these feeds, update shared/pairs.js:');
    console.log('Update the "feed" address for each pair\n');
  }
}

discoverFeeds().catch(console.error);
