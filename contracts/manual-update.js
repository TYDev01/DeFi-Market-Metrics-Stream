// Manual script to trigger performUpkeep on MetricsUpdater contract
require('dotenv').config();
const { createWalletClient, createPublicClient, http } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');

const RPC_URL = process.env.SOMNIA_RPC_URL || 'https://dream-rpc.somnia.network';
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const CONTRACT_ADDRESS = process.env.METRICS_UPDATER_ADDRESS || '0xD7b24aA7647324C4e3464132BA9CD3f680a8122e';

async function triggerUpdate() {
  console.log(' Triggering MetricsUpdater.performUpkeep()...\n');
  console.log('Contract:', CONTRACT_ADDRESS);
  console.log('RPC:', RPC_URL, '\n');

  const account = privateKeyToAccount(PRIVATE_KEY.startsWith('0x') ? PRIVATE_KEY : `0x${PRIVATE_KEY}`);
  
  const publicClient = createPublicClient({
    transport: http(RPC_URL, { timeout: 120000 })
  });

  const walletClient = createWalletClient({
    account,
    transport: http(RPC_URL, { timeout: 120000 })
  });

  try {
    // Call performUpkeep with higher gas limit
    const hash = await walletClient.writeContract({
      address: CONTRACT_ADDRESS,
      abi: [{
        name: 'performUpkeep',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [{ name: 'performData', type: 'bytes' }],
        outputs: []
      }],
      functionName: 'performUpkeep',
      args: ['0x'],
      gas: 8000000n,  // 8M gas limit
      gasPrice: 50000000000n  // 50 gwei
    });

    console.log(' Transaction sent!');
    console.log('Transaction hash:', hash);
    console.log('\nWaiting for confirmation...');

    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    
    console.log(' Transaction confirmed!');
    console.log('Block:', receipt.blockNumber.toString());
    console.log('Gas used:', receipt.gasUsed.toString());
    console.log('\n Prices updated successfully!');
    console.log('\nYou can now check the dashboard for live data.');
    
  } catch (error) {
    console.error(' Error:', error.message);
    process.exit(1);
  }
}

triggerUpdate();
