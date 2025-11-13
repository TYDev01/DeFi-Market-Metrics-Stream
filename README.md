# Somnia On-Chain Analytics - DeFi Market Metrics Stream

Real-time cryptocurrency price dashboard powered by **Chainlink Data Feeds**, **Chainlink Automation**, and **Somnia Data Streams**. This Somnia Data streams fetches live price data every 10 minutes from Chainlink oracles and displays it on a beautiful Next.js dashboard with automatic updates.

##  Features

-  **Real-time Price Data**: Fetches SOMI, ETH, BTC, LINK prices from Chainlink every 10 minutes
-  **Automatic Updates**: Chainlink Automation triggers on-chain updates (or manual cron)
-  **Live Dashboard**: Next.js dashboard with auto-refresh (no dummy data!)
-  **On-chain Storage**: Prices stored in Somnia Data Streams for transparency
-  **Price Alerts**: Telegram bot integration for threshold-based notifications
-  **Full History**: Track price changes and percentage movements over time

##  Project Structure

- `contracts/` – Solidity contracts (MetricsUpdater) that fetch Chainlink prices and write to Somnia streams
- `dashboard/` – Next.js dashboard with real-time API that fetches from Somnia streams  
- `telegram-bot/` – Node.js bot for price alerts via Telegram
- `shared/` – Shared configuration for tracked pairs
- `scripts/` – Setup scripts for Somnia Data Streams

##  Quick Start

**See [SETUP_GUIDE.md](./SETUP_GUIDE.md) for complete setup instructions.**

### Prerequisites

- [Foundry](https://book.getfoundry.sh/getting-started/installation)
- Node.js 20+ and npm/yarn/pnpm
- Wallet with STM tokens for Somnia Dream testnet
- Private key for contract deployment

### TL;DR Setup

```bash
# 1. Setup Somnia schema
npm install
npx tsx scripts/setupSomnia.ts

# 2. Deploy contracts
cd contracts
cp .env.example .env  # Add your PRIVATE_KEY and addresses
forge script script/Deploy.s.sol --rpc-url $SOMNIA_RPC_URL --broadcast --legacy
forge script script/InitPairs.s.sol --rpc-url $SOMNIA_RPC_URL --broadcast --legacy

# 3. Trigger first update
./update-prices.sh

# 4. Run dashboard
cd ../dashboard
cp .env.example .env.local  # Add your contract addresses
npm install
npm run dev
```

Visit `http://localhost:3000` to see your live dashboard! 

##  How It Works

```
Chainlink Price Feeds → MetricsUpdater Contract → Somnia Data Streams → Dashboard API → UI
     (Every 10min)            (On-chain)              (On-chain)         (Server)   (Browser)
```

1. **Chainlink Automation** calls `performUpkeep()` every 10 minutes
2. **MetricsUpdater.sol** fetches latest prices from Chainlink oracles (SOMI/USD, ETH/USD, BTC/USD, LINK/USD)
3. Prices are written to **Somnia Data Streams** with full metadata
4. **Dashboard API** (`/api/metrics`) reads from Somnia streams every 60 seconds
5. **Next.js UI** displays real-time prices with auto-refresh

##  Key Components

### Contracts (`contracts/`)

**MetricsUpdater.sol** - Main contract that:
- Fetches prices from Chainlink `AggregatorV3Interface` feeds
- Calculates price deltas and percentage changes
- Stores data in Somnia Data Streams
- Compatible with Chainlink Automation (10-minute cadence)

**Deployed Address:** `0x1e464C6CbF08edA700685fae91D15763CF88Ba6f` (Somnia Dream testnet)

```bash
# Manual update trigger
cd contracts
./update-prices.sh

# Check contract state
cast call $METRICS_UPDATER_ADDRESS "pairCount()" --rpc-url $SOMNIA_RPC_URL
cast call $METRICS_UPDATER_ADDRESS "lastUpkeepTimestamp()" --rpc-url $SOMNIA_RPC_URL
```

### Dashboard (`dashboard/`)

Modern Next.js 14 dashboard with:
- **Real-time API** (`/api/metrics`) that fetches from Somnia Data Streams
- **Auto-refresh** every 60 seconds (configurable)
- **No dummy data** - shows actual Chainlink prices or clear error messages
- **Beautiful UI** with shadcn components and Chart.js visualizations
- **Price statistics**: Average change, biggest move, tracked pairs count

```bash
cd dashboard
npm install
npm run dev  # Starts on http://localhost:3000
```

**Environment Variables** (`.env.local`):
```bash
SOMNIA_RPC_URL=https://dream-rpc.somnia.network
SOMNIA_STREAM_ADDRESS=0x6AB397FF662e42312c003175DCD76EfF69D048Fc
SOMNIA_SCHEMA_ID=0xef2f7b0e80ac4e2b5f955cf27f49ebaf2804f313f80435ee7c5d81b60ff62c97
METRICS_UPDATER_ADDRESS=0x1e464C6CbF08edA700685fae91D15763CF88Ba6f
NEXT_PUBLIC_REFRESH_INTERVAL_MS=60000  # Refresh every 60 seconds
```

**API Endpoints:**
- `GET /api/metrics` - Fetches latest prices from Somnia streams
  - Returns: `{ metrics: PriceMetric[], timestamp: number }`
  - Updates: Auto-refreshes every 60s in the UI

## Telegram Bot (`telegram-bot/`)

- Uses `node-telegram-bot-api` with long polling.
- Stores chat subscriptions in `data/subscriptions.json`.
- Polls Somnia stream on a cadence (`POLL_INTERVAL_MS`, default 5 minutes) and notifies on % price moves.
- `/subscribe`, `/setthreshold`, `/stop` commands manage pair-specific preferences (pair list comes from `shared/pairs.js`).

### Environment

```
TELEGRAM_BOT_TOKEN=123456:ABC
SOMNIA_RPC_URL=https://dream-rpc.somnia.network
SOMNIA_STREAM_ADDRESS=0x...
SOMNIA_SCHEMA_ID=0x...
POLL_INTERVAL_MS=300000
LOG_LEVEL=info
```

### Commands

```bash
cd telegram-bot
npm install
npm run dev # tsx watch mode
npm run build && npm start
```

## Data Schema

Metrics follow the Somnia DeFi schema:

```
uint64  timestamp
string  baseToken
string  quoteToken
string  pairId
string  source
uint256 price
int256  delta
int256  deltaBps
address priceFeed
uint8   decimals
address baseTokenAddress
address quoteTokenAddress
```

`dataKey` is `keccak256(abi.encodePacked(baseTokenAddress, quoteTokenAddress, pairId))`, so every surface (contract, dashboard, Telegram bot) references the same composite key.

### Pair Configuration

All off-chain components read the tracked pairs from `shared/pairs.js`. Keep that list in sync with:

- `contracts/.env` (`PAIR_COUNT`, `PAIR0_*`, …) so the Foundry scripts register the same feeds on-chain.
- `shared/pairs.js` so the dashboard and Telegram bot query/alert for the exact same set of pairs.

Each entry defines `baseToken`, `quoteToken`, `pairId`, `source`, and (optionally) the Chainlink feed address for documentation.

## Automation

Register `MetricsUpdater` with Chainlink Automation:

1. Deploy the contract.
2. Configure pairs via `initPairs` once or `registerPair` for incremental additions (use `updatePair` to change feeds/metadata).
3. Register with Automation Registry: target address, gas limit, and `interval = 600` seconds (or your chosen cadence set via `setInterval`).
4. Chainlink nodes call `performUpkeep` automatically, persisting new Somnia price entries with cached feed decimals for lower gas.

## Development Notes

- `shared/pairs.js` is the single source of truth for tracked pairs—update it (and the corresponding `PAIR*_` env vars) whenever you add/remove feeds.
- Dashboard and bot handle absent RPC/env variables by falling back to local mock data, simplifying front-end development without on-chain connectivity.
- Pair deltas are computed on-chain; the bot still double-checks relative to its previous cache to avoid duplicate alerts.
