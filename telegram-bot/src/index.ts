import "dotenv/config";
import TelegramBot from "node-telegram-bot-api";
import pino from "pino";
import { Hex } from "viem";
import { fetchMetricsFromSomnia, SomniaMetric } from "./somnia.js";
import { SubscriptionStore, Subscription } from "./store.js";
import { TRACKED_PAIRS } from "../../shared/pairs.js";

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

type MetricCache = Map<string, SomniaMetric>;

const cache: MetricCache = new Map();
const store = new SubscriptionStore();
const bot = new TelegramBot(token, { polling: true });
const trackedPairs = TRACKED_PAIRS;

if (!trackedPairs.length) {
  logger.warn("TRACKED_PAIRS is empty; the bot will not produce alerts until you configure shared/pairs.js.");
}

bot.setMyCommands([
  { command: "start", description: "Subscribe to Somnia price alerts" },
  { command: "subscribe", description: "Follow specific pairs (/subscribe SOM-USDT)" },
  { command: "setthreshold", description: "Change alert threshold (/setthreshold 3)" },
  { command: "stop", description: "Unsubscribe from updates" }
]);

function formatDecimal(value: bigint, decimals: number): number {
  if (decimals <= 0) return Number(value);
  const safeDecimals = Math.min(decimals, 18);
  const scale = Number(10n ** BigInt(safeDecimals));
  return Number(value) / scale;
}

function formatPrice(amount: bigint, decimals: number, quoteToken: string): string {
  const numeric = formatDecimal(amount, decimals);
  const fractionDigits = numeric >= 1 ? 4 : 6;
  return `${numeric.toLocaleString(undefined, { maximumFractionDigits: fractionDigits })} ${quoteToken}`;
}

function formatDelta(amount: bigint, decimals: number, quoteToken: string): string {
  const numeric = formatDecimal(amount, decimals);
  const sign = numeric >= 0 ? "+" : "-";
  const absValue = Math.abs(numeric);
  const fractionDigits = absValue >= 1 ? 4 : 6;
  return `${sign}${absValue.toLocaleString(undefined, { maximumFractionDigits: fractionDigits })} ${quoteToken}`;
}

function percentChange(current: bigint, previous: bigint): number {
  if (previous === 0n) return 0;
  const diff = Number(current) - Number(previous);
  const base = Number(previous);
  return (diff / base) * 100;
}

function formatMetricLine(metric: SomniaMetric, changePercent: number) {
  const direction = changePercent >= 0 ? "▲" : "▼";
  const changeText = `${direction} ${Math.abs(changePercent).toFixed(2)}%`;

  return [
    ` *${metric.pairId}* (${metric.source})`,
    `Change: *${changeText}* (${formatDelta(metric.priceDelta, metric.decimals, metric.quoteToken)})`,
    `Price: ${formatPrice(metric.price, metric.decimals, metric.quoteToken)}`,
    `Updated at: ${new Date(metric.timestamp * 1000).toLocaleTimeString()}`
  ].join("\n");
}

async function getOrCreateSubscription(chatId: number): Promise<Subscription> {
  const existing = await store.get(chatId);
  if (existing) return existing;
  const fallback: Subscription = { pairs: [], threshold: 5 };
  await store.set(chatId, fallback);
  return fallback;
}

bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const subscription = await getOrCreateSubscription(chatId);

  const text = [
    " Welcome to the Somnia price alert bot!",
    "",
    `Current threshold: ${subscription.threshold}%`,
    subscription.pairs.length
      ? `Tracking pairs: ${subscription.pairs.join(", ")}`
      : "Tracking all configured pairs.",
    "",
    "Commands:",
    "• /subscribe <pair>[,<pair>...] (example: /subscribe SOM-USDT,ETH-USD)",
    "• /setthreshold <percent>",
    "• /stop"
  ].join("\n");

  await bot.sendMessage(chatId, text);
});

bot.onText(/\/subscribe(?:\s+(.+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const pairInput = (match?.[1] ?? "").trim();
  const subscription = await getOrCreateSubscription(chatId);

  if (!trackedPairs.length) {
    await bot.sendMessage(chatId, "No tracked pairs are configured yet. Update shared/pairs.js to enable subscriptions.");
    return;
  }

  if (!pairInput.length) {
    subscription.pairs = [];
    await store.set(chatId, subscription);
    await bot.sendMessage(chatId, "You will receive alerts for all pairs.");
    return;
  }

  const requested = pairInput.split(/[,\s]+/).filter(Boolean);
  const available = new Map(trackedPairs.map((pair) => [pair.pairId.toLowerCase(), pair.pairId]));

  const resolved: string[] = [];
  const invalid: string[] = [];

  for (const candidate of requested) {
    const key = candidate.toLowerCase();
    if (available.has(key)) {
      resolved.push(available.get(key)!);
    } else {
      invalid.push(candidate);
    }
  }

  if (invalid.length) {
    await bot.sendMessage(
      chatId,
      `Unknown pairs: ${invalid.join(", ")}. Available: ${trackedPairs.map((pair) => pair.pairId).join(", ")}`
    );
    return;
  }

  subscription.pairs = Array.from(new Set(resolved));
  await store.set(chatId, subscription);
  await bot.sendMessage(chatId, `Updated subscriptions: ${subscription.pairs.join(", ")}`);
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
  if (!rpcUrl || !streamAddress || !schemaId || !trackedPairs.length) {
    return;
  }

  try {
    const metrics = await fetchMetricsFromSomnia(rpcUrl, streamAddress, schemaId, trackedPairs);
    logger.info({ count: metrics.length }, "Fetched Somnia metrics");

    for (const metric of metrics) {
      const key = metric.pairId;
      const previous = cache.get(key);
      let change = metric.priceDeltaPercent;

      if (previous && metric.timestamp !== previous.timestamp) {
        change = percentChange(metric.price, previous.price);
      }

      cache.set(key, metric);

      if (!previous) continue;
      if (Math.abs(change) < 0.01) continue;

      const entries = await store.entries();
      for (const [chatId, subscription] of entries) {
        if (subscription.pairs.length > 0 && !subscription.pairs.includes(metric.pairId)) {
          continue;
        }

        if (Math.abs(change) < subscription.threshold) {
          continue;
        }

        await bot.sendMessage(chatId, formatMetricLine(metric, change), { parse_mode: "Markdown" });
      }
    }
  } catch (error) {
    logger.error({ err: error }, "Metrics polling failed");
  }
}

setInterval(pollAndNotify, Number(process.env.POLL_INTERVAL_MS ?? 300_000));
pollAndNotify().catch((error) => logger.error({ err: error }, "Initial poll failed"));

logger.info("Somnia Telegram bot started.");
