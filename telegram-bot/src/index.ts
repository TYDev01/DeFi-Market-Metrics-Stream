import "dotenv/config";
import TelegramBot from "node-telegram-bot-api";
import pino from "pino";
import { SubscriptionStore, Subscription } from "./store.js";
import { TRACKED_PAIRS } from "../../shared/pairs.js";

const logger = pino({ level: process.env.LOG_LEVEL ?? "info" });

const token = process.env.TELEGRAM_BOT_TOKEN;
const channelId = process.env.CHANNEL_ID;
const apiUrl = process.env.API_URL ?? "https://de-fi-market-metrics-stream.vercel.app/api/metrics";

if (!token) {
  throw new Error("TELEGRAM_BOT_TOKEN is required");
}

if (!channelId) {
  logger.warn("CHANNEL_ID not set. Bot will only send to individual subscribers.");
}

interface SomniaMetric {
  timestamp: number;
  baseToken: string;
  quoteToken: string;
  pairId: string;
  source: string;
  price: number;
  priceDelta: number;
  priceDeltaPercent: number;
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

function formatPrice(amount: number, quoteToken: string): string {
  const fractionDigits = amount >= 1 ? 2 : 6;
  return `${amount.toLocaleString(undefined, { maximumFractionDigits: fractionDigits })} ${quoteToken}`;
}

function formatDelta(amount: number, quoteToken: string): string {
  const sign = amount >= 0 ? "+" : "-";
  const absValue = Math.abs(amount);
  const fractionDigits = absValue >= 1 ? 2 : 6;
  return `${sign}${absValue.toLocaleString(undefined, { maximumFractionDigits: fractionDigits })} ${quoteToken}`;
}

function percentChange(current: number, previous: number): number {
  if (previous === 0) return 0;
  const diff = current - previous;
  return (diff / previous) * 100;
}

function formatMetricLine(metric: SomniaMetric, changePercent: number) {
  const direction = changePercent >= 0 ? "▲" : "▼";
  const changeText = `${direction} ${Math.abs(changePercent).toFixed(2)}%`;

  return [
    ` *${metric.pairId}* (${metric.source})`,
    `Change: *${changeText}* (${formatDelta(metric.priceDelta, metric.quoteToken)})`,
    `Price: ${formatPrice(metric.price, metric.quoteToken)}`,
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

async function fetchMetricsFromAPI(): Promise<SomniaMetric[]> {
  const response = await fetch(apiUrl);
  if (!response.ok) {
    throw new Error(`API request failed: ${response.statusText}`);
  }
  const data = await response.json();
  return data.metrics || [];
}

async function sendChannelUpdate() {
  if (!channelId || !trackedPairs.length) {
    return;
  }

  try {
    const metrics = await fetchMetricsFromAPI();
    logger.info({ count: metrics.length }, "Fetched metrics for channel update");

    if (metrics.length === 0) {
      return;
    }

    // Get current time
    const now = new Date();
    const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const date = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    // Build a beautiful market update message
    let message = `╔═══════════════════════╗\n`;
    message += `║   📊 *MARKET UPDATE*   ║\n`;
    message += `╚═══════════════════════╝\n\n`;
    message += `🕐 ${time} • 📅 ${date}\n`;
    message += `━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    // Separate gains and losses
    const gains = metrics.filter(m => m.priceDeltaPercent > 0).sort((a, b) => b.priceDeltaPercent - a.priceDeltaPercent);
    const losses = metrics.filter(m => m.priceDeltaPercent < 0).sort((a, b) => a.priceDeltaPercent - b.priceDeltaPercent);
    const neutral = metrics.filter(m => m.priceDeltaPercent === 0);

    // Top gainers
    if (gains.length > 0) {
      message += `🟢 *TOP GAINERS*\n`;
      for (const metric of gains) {
        const priceFormatted = formatPrice(metric.price, metric.quoteToken);
        const changeText = `+${metric.priceDeltaPercent.toFixed(2)}%`;
        const emoji = metric.priceDeltaPercent >= 5 ? '🚀' : metric.priceDeltaPercent >= 2 ? '📈' : '↗️';
        message += `${emoji} *${metric.pairId}* → \`${priceFormatted}\` (${changeText})\n`;
      }
      message += `\n`;
    }

    // Top losers
    if (losses.length > 0) {
      message += `🔴 *TOP LOSERS*\n`;
      for (const metric of losses) {
        const priceFormatted = formatPrice(metric.price, metric.quoteToken);
        const changeText = `${metric.priceDeltaPercent.toFixed(2)}%`;
        const emoji = metric.priceDeltaPercent <= -5 ? '💥' : metric.priceDeltaPercent <= -2 ? '📉' : '↘️';
        message += `${emoji} *${metric.pairId}* → \`${priceFormatted}\` (${changeText})\n`;
      }
      message += `\n`;
    }

    // Neutral (no change)
    if (neutral.length > 0) {
      message += `⚪️ *STABLE*\n`;
      for (const metric of neutral) {
        const priceFormatted = formatPrice(metric.price, metric.quoteToken);
        message += `━ *${metric.pairId}* → \`${priceFormatted}\` (0.00%)\n`;
      }
      message += `\n`;
    }

    // Summary statistics
    const totalChange = metrics.reduce((sum, m) => sum + Math.abs(m.priceDeltaPercent), 0);
    const avgChange = (totalChange / metrics.length).toFixed(2);
    const biggestMover = [...metrics].sort((a, b) => Math.abs(b.priceDeltaPercent) - Math.abs(a.priceDeltaPercent))[0];
    
    message += `━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    message += `📊 *Market Stats*\n`;
    message += `• Avg Movement: ${avgChange}%\n`;
    message += `• Biggest Mover: ${biggestMover.pairId} (${Math.abs(biggestMover.priceDeltaPercent).toFixed(2)}%)\n`;
    message += `• Gainers: ${gains.length} | Losers: ${losses.length}\n\n`;
    message += `⏰ _Next update in 10 minutes_\n`;
    message += `🔗 [View Dashboard](https://de-fi-market-metrics-stream.vercel.app)`;

    await bot.sendMessage(channelId, message, { parse_mode: "Markdown", disable_web_page_preview: true });
    logger.info("Market update sent to channel");
  } catch (error) {
    logger.error({ err: error }, "Failed to send channel update");
  }
}

async function pollAndNotify() {
  if (!trackedPairs.length) {
    return;
  }

  try {
    const metrics = await fetchMetricsFromAPI();
    logger.info({ count: metrics.length }, "Fetched metrics from API");

    for (const metric of metrics) {
      const key = metric.pairId;
      const previous = cache.get(key);
      let change = metric.priceDeltaPercent;

      if (previous && metric.timestamp !== previous.timestamp) {
        change = percentChange(metric.price, previous.price);
      }

      cache.set(key, metric);

      if (!previous) continue;

      // Send to individual subscribers based on their threshold
      const entries = await store.entries();
      for (const [chatId, subscription] of entries) {
        if (subscription.pairs.length > 0 && !subscription.pairs.includes(metric.pairId)) {
          continue;
        }

        if (Math.abs(change) < subscription.threshold) {
          continue;
        }

        try {
          await bot.sendMessage(chatId, formatMetricLine(metric, change), { parse_mode: "Markdown" });
          logger.info({ chatId, pairId: metric.pairId, change }, "Alert sent to subscriber");
        } catch (error) {
          logger.error({ err: error, chatId }, "Failed to send message to subscriber");
        }
      }
    }
  } catch (error) {
    logger.error({ err: error }, "Metrics polling failed");
  }
}

// Send channel updates every 10 minutes (600000ms)
const CHANNEL_UPDATE_INTERVAL = 600_000;
setInterval(sendChannelUpdate, CHANNEL_UPDATE_INTERVAL);
sendChannelUpdate().catch((error) => logger.error({ err: error }, "Initial channel update failed"));

// Poll for individual subscriber alerts every 5 minutes
setInterval(pollAndNotify, Number(process.env.POLL_INTERVAL_MS ?? 300_000));
pollAndNotify().catch((error) => logger.error({ err: error }, "Initial poll failed"));

logger.info("Somnia Telegram bot started with 10-minute channel updates.");
