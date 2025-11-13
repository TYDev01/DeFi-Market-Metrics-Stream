// Set interval to 60 seconds for testing
require('dotenv').config();
const { createWalletClient, http } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');

const RPC_URL = process.env.SOMNIA_RPC_URL;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const CONTRACT_ADDRESS = process.env.METRICS_UPDATER_ADDRESS;

async function setInterval() {
  console.log('  Setting interval to 60 seconds for testing...\n');

  const account = privateKeyToAccount(PRIVATE_KEY.startsWith('0x') ? PRIVATE_KEY : `0x${PRIVATE_KEY}`);
  
  const walletClient = createWalletClient({
    account,
    transport: http(RPC_URL, { timeout: 120000 })
  });

  try {
    const hash = await walletClient.writeContract({
      address: CONTRACT_ADDRESS,
      abi: [{
        name: 'setInterval',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [{ name: 'newInterval', type: 'uint32' }],
        outputs: []
      }],
      functionName: 'setInterval',
      args: [60], // 60 seconds
      gas: 100000n,
      gasPrice: 50000000000n
    });

    console.log(' Transaction sent:', hash);
    console.log('New interval: 60 seconds (1 minute)\n');
    console.log('Wait a moment, then run: node manual-update.js');
    
  } catch (error) {
    console.error(' Error:', error.message);
  }
}

setInterval();
