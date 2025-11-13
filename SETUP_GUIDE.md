# Setup Guide: DeFi Market Metrics Stream

This guide will walk you through setting up the complete system to fetch Chainlink price data every 10 minutes and display it on the dashboard.

## Prerequisites

- [Foundry](https://book.getfoundry.sh/getting-started/installation) installed
- Node.js 20+ and pnpm/npm/yarn
- Private key with STM tokens for Somnia Dream testnet
- Access to Somnia Dream RPC: `https://dream-rpc.somnia.network`

## Step 1: Setup Somnia Data Streams

First, register your data schema with Somnia:

```bash
# Install dependencies
npm install

# Create a .env file in the root directory
cat > .env << EOF
SOMNIA_RPC_URL=https://dream-rpc.somnia.network
PRIVATE_KEY=your_private_key_here
SOMNIA_CHAIN_ID=50312
SOMNIA_SCHEMA_NAME=SomniaDefiMetrics
EOF

# Run the setup script to register the schema
npx tsx scripts/setupSomnia.ts
```

**Important:** Copy the output values:
- Schema ID (e.g., `0xef2f7b0e...`)
- Protocol Address (Stream Writer address, e.g., `0x6AB397FF...`)

## Step 2: Deploy the MetricsUpdater Contract

```bash
cd contracts

# Create a .env file for deployment
cat > .env << EOF
SOMNIA_RPC_URL=https://dream-rpc.somnia.network
PRIVATE_KEY=your_private_key_here
OWNER_ADDRESS=your_wallet_address
SOMNIA_STREAM_WRITER=0x6AB397FF662e42312c003175DCD76EfF69D048Fc
SOMNIA_SCHEMA_ID=0xef2f7b0e80ac4e2b5f955cf27f49ebaf2804f313f80435ee7c5d81b60ff62c97
EOF

# Install Foundry dependencies
forge install

# Deploy the contract
forge script script/Deploy.s.sol --rpc-url $SOMNIA_RPC_URL --broadcast --legacy
```

**Copy the deployed MetricsUpdater contract address** from the output.

## Step 3: Initialize Price Feed Pairs

Update the contract environment with pair configurations:

```bash
# Add to contracts/.env
cat >> .env << EOF

METRICS_UPDATER_ADDRESS=0x1e464C6CbF08edA700685fae91D15763CF88Ba6f

# Configure pairs (these are Chainlink feeds on Somnia)
PAIR_COUNT=3

# ETH/USD
PAIR0_FEED=0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419
PAIR0_SOURCE=Chainlink
PAIR0_BASE_SYMBOL=ETH
PAIR0_BASE_ADDRESS=0x0000000000000000000000000000000000000003
PAIR0_QUOTE_SYMBOL=USD
PAIR0_QUOTE_ADDRESS=0x0000000000000000000000000000000000000004
PAIR0_PAIR_ID=ETH-USD

# BTC/USD
PAIR1_FEED=0xF4030086522a5bEEa4988F8cA5B36dbC97BeE88c
PAIR1_SOURCE=Chainlink
PAIR1_BASE_SYMBOL=BTC
PAIR1_BASE_ADDRESS=0x0000000000000000000000000000000000000005
PAIR1_QUOTE_SYMBOL=USD
PAIR1_QUOTE_ADDRESS=0x0000000000000000000000000000000000000004
PAIR1_PAIR_ID=BTC-USD

# LINK/USD
PAIR2_FEED=0x2c1d072e956AFFC0D435Cb7AC38EF18d24d9127c
PAIR2_SOURCE=Chainlink
PAIR2_BASE_SYMBOL=LINK
PAIR2_BASE_ADDRESS=0x0000000000000000000000000000000000000006
PAIR2_QUOTE_SYMBOL=USD
PAIR2_QUOTE_ADDRESS=0x0000000000000000000000000000000000000004
PAIR2_PAIR_ID=LINK-USD
EOF

# Initialize the pairs
forge script script/InitPairs.s.sol --rpc-url $SOMNIA_RPC_URL --broadcast --legacy
```

## Step 4: Trigger the First Update

Manually trigger the contract to fetch and store the initial prices:

```bash
# Using cast to call performUpkeep
cast send $METRICS_UPDATER_ADDRESS "performUpkeep(bytes)" "0x" \
  --rpc-url $SOMNIA_RPC_URL \
  --private-key $PRIVATE_KEY \
  --legacy
```

## Step 5: Setup the Dashboard

```bash
cd ../dashboard

# Copy the environment template
cp .env.example .env.local

# Edit .env.local with your values
cat > .env.local << EOF
SOMNIA_RPC_URL=https://dream-rpc.somnia.network
SOMNIA_STREAM_ADDRESS=0x6AB397FF662e42312c003175DCD76EfF69D048Fc
SOMNIA_SCHEMA_ID=0xef2f7b0e80ac4e2b5f955cf27f49ebaf2804f313f80435ee7c5d81b60ff62c97
METRICS_UPDATER_ADDRESS=0x06de4af031aefda3767dd2bbc0c81be92f39772a
NEXT_PUBLIC_TELEGRAM_BOT_URL=https://t.me/somnia_alerts_bot
NEXT_PUBLIC_REFRESH_INTERVAL_MS=60000
EOF

# Install dependencies
npm install

# Run the development server
npm run dev
```

Visit `http://localhost:3000` to see your dashboard!

## Step 6: Setup Chainlink Automation (For Automatic Updates)

To have the contract update automatically every 10 minutes:

1. Go to [Chainlink Automation](https://automation.chain.link)
2. Connect your wallet to Somnia Dream testnet
3. Click "Register New Upkeep"
4. Select "Custom Logic"
5. Enter your MetricsUpdater contract address: `0x1e464C6CbF08edA700685fae91D15763CF88Ba6f`
6. Fund the upkeep with LINK tokens
7. The automation will call `performUpkeep` every 10 minutes

**Alternative:** You can set up a cron job to call `performUpkeep` manually:

```bash
# Add to crontab (runs every 10 minutes)
*/10 * * * * cast send 0x1e464C6CbF08edA700685fae91D15763CF88Ba6f "performUpkeep(bytes)" "0x" --rpc-url https://dream-rpc.somnia.network --private-key YOUR_KEY --legacy
```

## Verification

1. **Check if pairs are registered:**
   ```bash
   cast call $METRICS_UPDATER_ADDRESS "pairCount()" --rpc-url $SOMNIA_RPC_URL
   ```

2. **Check last update time:**
   ```bash
   cast call $METRICS_UPDATER_ADDRESS "lastUpkeepTimestamp()" --rpc-url $SOMNIA_RPC_URL
   ```

3. **Fetch metrics from API:**
   ```bash
   curl http://localhost:3000/api/metrics
   ```

## Troubleshooting

### "No metrics available" error
- Make sure you've run `performUpkeep` at least once
- Verify the contract address in `.env.local` matches your deployed contract
- Check that pairs are initialized with `cast call $METRICS_UPDATER_ADDRESS "pairCount()"`

### Dashboard shows no data
- Verify environment variables in `dashboard/.env.local`
- Check browser console for errors
- Ensure the Somnia RPC endpoint is accessible
- Try manually refreshing: `curl http://localhost:3000/api/metrics`

### Price feeds not updating
- Verify Chainlink Automation is set up and funded
- Check the contract's `interval` setting (should be 600 seconds = 10 minutes)
- Manually trigger an update to test: `cast send ... "performUpkeep(bytes)" "0x"`

### Invalid price feed addresses
- Ensure you're using Chainlink feeds that exist on Somnia Dream testnet
- Check the official Chainlink documentation for Somnia feed addresses
- Test each feed individually with: `cast call $FEED_ADDRESS "latestRoundData()"`

## Architecture Overview

```
┌─────────────────────┐
│ Chainlink Automation│
│   (Every 10 min)    │
└──────────┬──────────┘
           │ triggers
           ▼
┌─────────────────────┐
│ MetricsUpdater.sol  │◄──── Reads from Chainlink Price Feeds
│   (On-chain)        │
└──────────┬──────────┘
           │ writes to
           ▼
┌─────────────────────┐
│ Somnia Data Streams │
│   (On-chain)        │
└──────────┬──────────┘
           │ reads from
           ▼
┌─────────────────────┐
│  Dashboard API      │
│  /api/metrics       │
└──────────┬──────────┘
           │ fetches every 60s
           ▼
┌─────────────────────┐
│   Next.js UI        │
│  (Browser)          │
└─────────────────────┘
```

## Next Steps

1. **Add more pairs:** Edit `shared/pairs.js` and re-run InitPairs script
2. **Setup Telegram bot:** Follow instructions in `telegram-bot/README.md`
3. **Deploy to production:** Use Somnia mainnet RPC and addresses
4. **Customize dashboard:** Modify components in `dashboard/components/`
