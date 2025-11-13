# Multi-Pair Price Tracking - Current Status

## Overview

The project is now configured to support **multiple cryptocurrency trading pairs** using Chainlink oracle feeds on Somnia network. The system can track any number of pairs - you just need to provide Chainlink feed addresses.

## Current Configuration

### Active Pairs

| Pair | Status | Network | Feed Address | Price |
|------|--------|---------|--------------|-------|
| SOM/USDT | ACTIVE | Somnia | 0xaEAa92c38939775d3be39fFA832A92611f7D6aDe | $0.366 |
| ETH/USD | ACTIVE | Ethereum | 0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419 | $3,422.20 |
| BTC/USD | ACTIVE | Ethereum | 0xF4030086522a5bEEa4988F8cA5B36dbC97BeE88c | $101,787.57 |
| LINK/USD | ACTIVE | Ethereum | 0x2c1d072e956AFFC0D435Cb7AC38EF18d24d9127c | $15.23 |

**All pairs are now ACTIVE!** The system fetches prices from Chainlink oracles on multiple networks (Somnia + Ethereum Mainnet) and publishes to Somnia Data Streams.

## How the Multi-Pair System Works

### 1. Configuration (`shared/pairs.js`)

All trading pairs are defined in a single configuration file:

```javascript
export const TRACKED_PAIRS = [
  {
    baseToken: "SOM",
    quoteToken: "USDT",
    baseAddress: "0x0000000000000000000000000000000000000001",
    quoteAddress: "0x0000000000000000000000000000000000000002",
    pairId: "SOM-USDT",
    source: "Chainlink",
    feed: "0xaEAa92c38939775d3be39fFA832A92611f7D6aDe"
  },
  // Add more pairs here...
];
```

### 2. Price Updates (`scripts/updateMultiplePairs.ts`)

Single script updates all pairs at once:

```bash
npx ts-node scripts/updateMultiplePairs.ts
```

The script:
- Iterates through all pairs in configuration
- Fetches price from each Chainlink feed
- Encodes data for Somnia Data Streams
- Publishes all pairs in a single transaction
- Skips pairs without valid feed addresses

### 3. Dashboard Display

The dashboard automatically:
- Reads all pairs from `shared/pairs.js`
- Fetches data for each pair from Somnia Streams
- Displays prices, changes, and charts
- Auto-refreshes every 60 seconds

## Adding New Pairs

### Step 1: Get Chainlink Feed Address

You need to find the Chainlink feed address for your desired pair on Somnia network.

**Finding Feeds:**

1. **Somnia Documentation**
   - Visit: https://docs.somnia.network
   - Look for Chainlink price feeds section

2. **Somnia Team**
   - Discord: Ask in #developers channel
   - Telegram: Contact support
   - Twitter: @SomniaNetwork

3. **Discovery Script**
   ```bash
   node scripts/discoverChainlinkFeeds.js
   ```
   Tests common Chainlink addresses

### Step 2: Update Configuration

Edit `shared/pairs.js` and add your pair:

```javascript
{
  baseToken: "YOUR_BASE",
  quoteToken: "YOUR_QUOTE",
  baseAddress: "0x0000000000000000000000000000000000000009",  // Unique address
  quoteAddress: "0x000000000000000000000000000000000000000a",  // Unique address
  pairId: "YOUR_BASE-YOUR_QUOTE",
  source: "Chainlink",
  feed: "0xYOUR_CHAINLINK_FEED_ADDRESS"  // The important part!
}
```

### Step 3: Test the Feed

```bash
# Quick test
node -e "
const { createPublicClient, http } = require('viem');
const client = createPublicClient({ 
  transport: http('https://dream-rpc.somnia.network') 
});

async function test() {
  const data = await client.readContract({
    address: '0xYOUR_FEED_ADDRESS',
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
  console.log('Price:', data[1].toString());
  console.log('Works!');
}
test();
"
```

### Step 4: Update Prices

```bash
npx ts-node scripts/updateMultiplePairs.ts
```

Output example:
```
Updating multiple pairs using Somnia SDK...

Processing SOM-USDT...
  Price: $0.36592830
  Ready for publication

Processing ETH-USD...
  Price: $2,456.78
  Ready for publication

Publishing 2 pair(s) to Somnia Streams...
Transaction sent!
Hash: 0x...
Price data published successfully!
```

### Step 5: View on Dashboard

```bash
cd dashboard
npm run dev
```

Open http://localhost:3001 - all pairs display automatically!

## Important Notes

### Multi-Network Architecture

**Key Innovation**: The system can fetch Chainlink prices from **any blockchain network**, not just Somnia!

How it works:
1. **Off-chain script** fetches prices from Chainlink feeds on multiple networks:
   - Somnia Dream testnet for SOM/USDT
   - Ethereum Mainnet for ETH/USD, BTC/USD, LINK/USD
2. **Somnia SDK** publishes all prices to Somnia Data Streams
3. **Dashboard** reads from Somnia Streams and displays all pairs

This approach provides:
- Access to mature Chainlink feeds on Ethereum Mainnet
- Lower cost (no need to deploy feeds on every network)
- Flexibility to add any Chainlink feed from any network
- Centralized data storage on Somnia for transparency

### Adding Feeds from Other Networks

You can add Chainlink feeds from:
- **Ethereum Mainnet** - Most mature feeds (current setup)
- **Arbitrum** - Lower fees
- **Polygon** - Fast updates
- **BSC** - Alternative data sources
- **Any EVM chain** with Chainlink feeds

Just update `shared/pairs.js` with the feed address and RPC URL!

## Automation

### Manual Updates
```bash
# Update all pairs once
npx ts-node scripts/updateMultiplePairs.ts
```

### Cron Job
```bash
# Edit crontab
crontab -e

# Add: Update every 10 minutes
*/10 * * * * cd /path/to/project && npx ts-node scripts/updateMultiplePairs.ts
```

### GitHub Actions
```yaml
name: Update Prices
on:
  schedule:
    - cron: '*/10 * * * *'
jobs:
  update:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npx ts-node scripts/updateMultiplePairs.ts
```

### Node.js Service
```typescript
// Background service
setInterval(async () => {
  await updateMultiplePairs();
}, 10 * 60 * 1000); // Every 10 minutes
```

## Troubleshooting

### "No Chainlink feed configured"
- Feed address is zero (0x000...000)
- Update `shared/pairs.js` with real feed address

### "Error: execution reverted"
- Feed doesn't exist on Somnia network
- Verify address with discovery script

### "Price is zero"
- Feed not initialized
- Check with Somnia team

### "No data to publish"
- All pairs skipped (no valid feeds)
- At least one pair needs valid feed address

## Files Modified

```
shared/pairs.js                    # Pair configuration (4 pairs)
scripts/updateMultiplePairs.ts     # Multi-pair update script (NEW)
scripts/discoverChainlinkFeeds.js  # Feed discovery tool (NEW)
ADDING_PAIRS.md                    # Detailed guide (NEW)
README.md                          # Updated with multi-pair info
```

## Next Steps

1. **Contact Somnia team** for additional Chainlink feed addresses
2. **Test discovered feeds** when addresses are available
3. **Update configuration** with new feed addresses
4. **Set up automation** for continuous price updates
5. **Monitor dashboard** for all pairs

## Resources

- **Somnia Docs**: https://docs.somnia.network
- **Chainlink Docs**: https://docs.chain.link
- **Project Guide**: [ADDING_PAIRS.md](./ADDING_PAIRS.md)
- **Setup Guide**: [SETUP_GUIDE.md](./SETUP_GUIDE.md)

---

**Status**: Multi-pair infrastructure complete. Waiting for additional Chainlink feed addresses from Somnia team to activate ETH/USD, BTC/USD, and LINK/USD pairs.
