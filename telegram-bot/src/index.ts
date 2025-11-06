import "dotenv/config";
import TelegramBot from "node-telegram-bot-api";
import pino from "pino";
import { Hex } from "viem";
import { fetchMetricsFromSomnia, SomniaMetric } from "./somnia.js";
import { SubscriptionStore, Subscription } from "./store.js";

const logger = pino({ level: process.env.LOG_LEVEL ?? "info" });

const token = process.env.TELEGRAM_BOT_TOKEN;
const rpcUrl = process.env.SOMNIA_RPC_URL;
const streamAddress = process.env.SOMNIA_STREAM_ADDRESS as Hex | undefined;
const schemaId = process.env.SOMNIA_SCHEMA_ID as Hex | undefined;

if (!token) {
  throw new Error("TELEGRAM_BOT_TOKEN is required");
}

if (!rpcUrl || !streamAddress || !schemaId) {
  logger.warn("Somnia environment variables missing, bot will operate in dry-run mode.");
}

const DEFAULT_POOLS = [
  { protocol: "SomniaSwap", network: "Somnia", poolId: "ETH-USD", baseToken: "ETH", quoteToken: "USD" },
  { protocol: "SomniaLend", network: "Somnia", poolId: "sETH", baseToken: "sETH", quoteToken: "USD" },
  { protocol: "SomniaYield", network: "Somnia", poolId: "Vault-01", baseToken: "ETH", quoteToken: "stETH" }
];

type MetricCache = Map<string, SomniaMetric>;

const cache: MetricCache = new Map();
const store = new SubscriptionStore();
const bot = new TelegramBot(token, { polling: true });

bot.setMyCommands([
  { command: "start", description: "Subscribe to Somnia alerts" },
  { command: "subscribe", description: "Follow specific protocols (/subscribe SomniaSwap)" },
  { command: "setthreshold", description: "Change alert threshold (/setthreshold 10)" },
  { command: "stop", description: "Unsubscribe from updates" }
]);

function formatBigUsd(value: bigint): string {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return `$${value.toString()}`;
  }
  if (numeric >= 1_000_000_000) {
    return `$${(numeric / 1_000_000_000).toFixed(2)}B`;
  }
  if (numeric >= 1_000_000) {
    return `$${(numeric / 1_000_000).toFixed(2)}M`;
  }
  if (numeric >= 10_000) {
    return `$${(numeric / 1_000).toFixed(1)}K`;
  }
  return `$${numeric.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function formatApr(aprBps: bigint): string {
  const numeric = Number(aprBps);
  return `${(numeric / 100).toFixed(2)}%`;
}

function percentChange(current: bigint, previous: bigint): number {
  if (previous === 0n) return 0;
  const diff = Number(current) - Number(previous);
  const base = Number(previous);
  return (diff / base) * 100;
}

function formatMetricLine(metric: SomniaMetric, change: number) {
  const direction = change >= 0 ? "▲" : "▼";
  const changeText = `${direction} ${change.toFixed(2)}%`;

  return [
    `🚨 *${metric.protocol}* (${metric.poolId}) alert`,
    `Change: *${changeText}*`,
    `TVL: ${formatBigUsd(metric.tvlUsd)}`,
    `24h Volume: ${formatBigUsd(metric.volume24hUsd)}`,
    `24h Fees: ${formatBigUsd(metric.fees24hUsd)}`,
    `APR: ${formatApr(metric.aprBps)}`
  ].join("\n");
}

async function getOrCreateSubscription(chatId: number): Promise<Subscription> {
  const existing = await store.get(chatId);
  if (existing) return existing;
  const fallback: Subscription = { protocols: [], threshold: 5 };
  await store.set(chatId, fallback);
  return fallback;
}

bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const subscription = await getOrCreateSubscription(chatId);

  const text = [
    "👋 Welcome to the Somnia DeFi Alerts bot!",
    "",
    `Current threshold: ${subscription.threshold}%`,
    subscription.protocols.length
      ? `Tracking protocols: ${subscription.protocols.join(", ")}`
      : "Tracking all supported protocols.",
    "",
    "Commands:",
    "• /subscribe <protocol>[,<protocol>...]",
    "• /setthreshold <percent>",
    "• /stop"
  ].join("\n");

  await bot.sendMessage(chatId, text);
});

bot.onText(/\/subscribe(?:\s+(.+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const protocolInput = (match?.[1] ?? "").trim();
  const subscription = await getOrCreateSubscription(chatId);

  if (!protocolInput.length) {
    subscription.protocols = [];
    await store.set(chatId, subscription);
    await bot.sendMessage(chatId, "You will receive alerts for all protocols.");
    return;
  }

  const requested = protocolInput.split(/[,\s]+/).filter(Boolean);
  const available = new Set(DEFAULT_POOLS.map((pool) => pool.protocol));
  const invalid = requested.filter((protocol) => !available.has(protocol));

  if (invalid.length) {
    await bot.sendMessage(chatId, `Unknown protocols: ${invalid.join(", ")}. Available: ${Array.from(available).join(", ")}`);
    return;
  }

  subscription.protocols = Array.from(new Set(requested));
  await store.set(chatId, subscription);
  await bot.sendMessage(chatId, `Updated subscriptions: ${subscription.protocols.join(", ")}`);
});

bot.onText(/\/setthreshold\s+(\d+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const value = Number(match?.[1] ?? 0);

  if (!Number.isFinite(value) || value <= 0 || value > 100) {
    await bot.sendMessage(chatId, "Please provide a threshold between 1 and 100.");
    return;
  }

  const subscription = await getOrCreateSubscription(chatId);
  subscription.threshold = value;
  await store.set(chatId, subscription);
  await bot.sendMessage(chatId, `Alert threshold set to ${value}%.`);
});

bot.onText(/\/stop/, async (msg) => {
  const chatId = msg.chat.id;
  await store.remove(chatId);
  await bot.sendMessage(chatId, "Unsubscribed. Use /start to join again.");
});

async function pollAndNotify() {
  if (!rpcUrl || !streamAddress || !schemaId) {
    return;
  }

  try {
    const metrics = await fetchMetricsFromSomnia(rpcUrl, streamAddress, schemaId, DEFAULT_POOLS);
    logger.info({ count: metrics.length }, "Fetched Somnia metrics");

    for (const metric of metrics) {
      const key = `${metric.protocol}:${metric.poolId}`;
      const previous = cache.get(key);

      if (previous) {
        const change = percentChange(metric.tvlUsd, previous.tvlUsd);

        if (Math.abs(change) >= 1) {
          const entries = await store.entries();
          for (const [chatId, subscription] of entries) {
            if (
              subscription.protocols.length > 0 &&
              !subscription.protocols.includes(metric.protocol)
            ) {
              continue;
            }

            if (Math.abs(change) < subscription.threshold) {
              continue;
            }

            await bot.sendMessage(chatId, formatMetricLine(metric, change), { parse_mode: "Markdown" });
          }
        }
      }

      cache.set(key, metric);
    }
  } catch (error) {
    logger.error({ err: error }, "Metrics polling failed");
  }
}

setInterval(pollAndNotify, Number(process.env.POLL_INTERVAL_MS ?? 300_000));
pollAndNotify().catch((error) => logger.error({ err: error }, "Initial poll failed"));

logger.info("Somnia Telegram bot started.");
