# Somnia On-Chain Analytics

End-to-end reference implementation of a DeFi analytics and alerting system powered by Chainlink Data Feeds, Chainlink Automation, and Somnia Data Streams.

- `contracts/` – Foundry workspace that encodes on-chain metrics via Somnia streams.
- `dashboard/` – Next.js + shadcn dashboard that reads public Somnia snapshots.
- `telegram-bot/` – Node.js Telegram bot that alerts users on threshold breaches.

## Prerequisites

- [Foundry](https://book.getfoundry.sh/getting-started/installation)
- Node.js 20+
- pnpm, npm, or yarn

## Contracts (`contracts/`)

Key contract: `src/MetricsUpdater.sol`

- Integrates `AggregatorV3Interface` price feeds, Somnia stream writer, Chainlink Automation.
- Encodes metrics using the Somnia DeFi schema and writes them via `somniaStream.set`.
- `checkUpkeep` enforces 10 minute cadence (configurable).
- `performUpkeep` calculates TVL/fees/volume/APR deltas and emits a stream entry per pool.

### Setup

```bash
cd contracts
forge install foundry-rs/forge-std
```

Update `foundry.toml` with `SOMNIA_RPC_URL`, then run:

```bash
forge test
forge script script/Deploy.s.sol --rpc-url $SOMNIA_RPC_URL --broadcast
forge script script/InitPools.s.sol --rpc-url $SOMNIA_RPC_URL --broadcast
```

Populate environment variables for the deployment script (`OWNER_ADDRESS`, `SOMNIA_STREAM_WRITER`, `SOMNIA_SCHEMA_ID`) and for initialisation (`METRICS_UPDATER_ADDRESS`, `POOL_COUNT`, `POOL0_*`, ...). Use `forge script ... --legacy --gas-limit 7000000 --slow` if you hit gas-estimation issues on mainnet-like networks.

## Dashboard (`dashboard/`)

Next.js App Router + shadcn styling + viem RPC client.

- Reads latest Somnia snapshots (falls back to mock data if RPC/config is missing).
- Displays metrics table with sorting/filtering.
- Visualises TVL, volume, fee trends (Chart.js).

### Environment

Copy `.env.example` (below) to `.env.local` and fill values:

```
SOMNIA_RPC_URL=https://dream-rpc.somnia.network
SOMNIA_STREAM_ADDRESS=0x...
SOMNIA_SCHEMA_ID=0x...
```

### Commands

```bash
cd dashboard
npm install
npm run dev
```

## Telegram Bot (`telegram-bot/`)

- Uses `node-telegram-bot-api` with long polling.
- Stores chat subscriptions in `data/subscriptions.json`.
- Polls Somnia stream on a cadence (`POLL_INTERVAL_MS`, default 5 minutes).
- `/subscribe`, `/setthreshold`, `/stop` commands manage preferences.

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
string  protocol
string  network
string  poolId
string  baseToken
string  quoteToken
uint256 tvlUsd
uint256 volume24hUsd
uint256 fees24hUsd
int256  aprBps
```

`dataKey` is `keccak256(abi.encodePacked(protocol, ":", network, ":", poolId))` to align with `toHex(protocol:network:poolId)`.

## Automation

Register `MetricsUpdater` with Chainlink Automation:

1. Deploy the contract.
2. Configure pools via `registerPool`.
3. Register with Automation Registry: target address, gas limit, and `interval = 600` seconds.
4. Chainlink nodes call `performUpkeep` automatically, persisting new Somnia stream entries.

## Development Notes

- Contracts assume liquidity amounts are provided with 18 decimals; adjust `_toUsd` if your protocol uses a different precision.
- Dashboard and bot handle absent RPC/env variables by falling back to local mock data, simplifying front-end development without on-chain connectivity.
- Extend `DEFAULT_POOLS` arrays in both the dashboard and bot to mirror the pools configured on-chain.
