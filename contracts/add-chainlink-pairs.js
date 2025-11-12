// Script to add ETH, BTC, LINK pairs to MetricsUpdater contract
require('dotenv').config();
const { createWalletClient, http } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');

const RPC_URL = process.env.SOMNIA_RPC_URL;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const CONTRACT_ADDRESS = process.env.METRICS_UPDATER_ADDRESS;

// Chainlink price feed addresses (these are Ethereum mainnet - you'll need Somnia equivalents)
const CHAINLINK_PAIRS = [
  {
    priceFeed: '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419', // ETH/USD
    baseToken: '0x0000000000000000000000000000000000000003',
    quoteToken: '0x0000000000000000000000000000000000000004',
    baseSymbol: 'ETH',
    quoteSymbol: 'USD',
    pairId: 'ETH-USD',
    source: 'Chainlink'
  },
  {
    priceFeed: '0xF4030086522a5bEEa4988F8cA5B36dbC97BeE88c', // BTC/USD
    baseToken: '0x0000000000000000000000000000000000000005',
    quoteToken: '0x0000000000000000000000000000000000000004',
    baseSymbol: 'BTC',
    quoteSymbol: 'USD',
    pairId: 'BTC-USD',
    source: 'Chainlink'
  },
  {
    priceFeed: '0x2c1d072e956AFFC0D435Cb7AC38EF18d24d9127c', // LINK/USD
    baseToken: '0x0000000000000000000000000000000000000006',
    quoteToken: '0x0000000000000000000000000000000000000004',
    baseSymbol: 'LINK',
    quoteSymbol: 'USD',
    pairId: 'LINK-USD',
    source: 'Chainlink'
  }
];

async function addPairs() {
  console.log(' Adding Chainlink pairs to MetricsUpdater...\n');
  console.log('Contract:', CONTRACT_ADDRESS);
  console.log('Pairs to add:', CHAINLINK_PAIRS.length, '\n');

  const account = privateKeyToAccount(PRIVATE_KEY.startsWith('0x') ? PRIVATE_KEY : `0x${PRIVATE_KEY}`);
  
  const walletClient = createWalletClient({
    account,
    transport: http(RPC_URL)
  });

  try {
    const hash = await walletClient.writeContract({
      address: CONTRACT_ADDRESS,
      abi: [{
        name: 'initPairs',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [{
          name: 'inputs',
          type: 'tuple[]',
          components: [
            { name: 'priceFeed', type: 'address' },
            { name: 'baseToken', type: 'address' },
            { name: 'quoteToken', type: 'address' },
            { name: 'baseSymbol', type: 'string' },
            { name: 'quoteSymbol', type: 'string' },
            { name: 'pairId', type: 'string' },
            { name: 'source', type: 'string' }
          ]
        }],
        outputs: []
      }],
      functionName: 'initPairs',
      args: [CHAINLINK_PAIRS],
      gasPrice: 50000000000n
    });

    console.log(' Transaction sent!');
    console.log('Hash:', hash);
    console.log('\n Waiting for confirmation...');
    console.log('\n Pairs should be added shortly!');
    console.log('\nNext step: Run "node manual-update.js" to fetch first prices');
    
  } catch (error) {
    console.error(' Error:', error.message);
    
    if (error.message.includes('Chainlink')) {
      console.log('\n  NOTE: These Chainlink feed addresses are from Ethereum mainnet.');
      console.log('You need to find the correct Chainlink feed addresses for Somnia network.');
      console.log('Check: https://docs.chain.link/data-feeds/price-feeds/addresses');
    }
    process.exit(1);
  }
}

addPairs();
