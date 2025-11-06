import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

export interface Subscription {
  protocols: string[];
  threshold: number;
}

type StoreShape = Record<string, Subscription>;

const fileUrl = new URL("../data/subscriptions.json", import.meta.url);
const filePath = fileURLToPath(fileUrl);

async function ensureFile() {
  try {
    await readFile(filePath, "utf8");
  } catch {
    await writeFile(filePath, "{}", "utf8");
  }
}

export class SubscriptionStore {
  private cache: StoreShape = {};
  private loaded = false;

  private async load() {
    if (this.loaded) return;
    await ensureFile();
    const raw = await readFile(filePath, "utf8");
    this.cache = raw.trim().length ? (JSON.parse(raw) as StoreShape) : {};
    this.loaded = true;
  }

  private async persist() {
    await writeFile(filePath, JSON.stringify(this.cache, null, 2), "utf8");
  }

  async get(chatId: number): Promise<Subscription | undefined> {
    await this.load();
    return this.cache[String(chatId)];
  }

  async set(chatId: number, subscription: Subscription): Promise<void> {
    await this.load();
    this.cache[String(chatId)] = subscription;
    await this.persist();
  }

  async remove(chatId: number): Promise<void> {
    await this.load();
    delete this.cache[String(chatId)];
    await this.persist();
  }

  async entries(): Promise<Array<[number, Subscription]>> {
    await this.load();
    return Object.entries(this.cache).map(([chatId, value]) => [Number(chatId), value]);
  }
}
