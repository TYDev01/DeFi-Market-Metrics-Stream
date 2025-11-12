import { NextResponse } from "next/server";
import { createPublicClient, createWalletClient, http, keccak256, encodeAbiParameters, parseAbiParameters, defineChain } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { SDK, SchemaEncoder } from "@somnia-chain/streams";
import { PriceMetric } from "@/lib/types";
import { TRACKED_PAIRS } from "../../../../shared/pairs.js";

type HexAddress = `0x${string}`;

type PairEntry = {
  baseToken: string;
  quoteToken: string;
  baseAddress: string;
  quoteAddress: string;
  pairId: string;
  source: string;
  feed: string;
};

// Schema matching the price data structure
const PRICE_SCHEMA = "uint64 timestamp, string baseSymbol, string quoteSymbol, string pairId, string source, uint256 price, int256 delta, int256 deltaBps, address priceFeed, uint8 feedDecimals, address baseToken, address quoteToken";

async function fetchMetricsFromSomnia(): Promise<PriceMetric[]> {
  const rpcUrl = process.env.SOMNIA_RPC_URL;
  const publisherAddress = process.env.OWNER_ADDRESS;

  if (!rpcUrl || !publisherAddress) {
    throw new Error("Missing required environment variables: SOMNIA_RPC_URL or OWNER_ADDRESS");
  }

  const chainId = 50312;
  const chain = defineChain({
    id: chainId,
    name: "Somnia Dream",
    network: "somnia-dream",
    nativeCurrency: { decimals: 18, name: "Somnia", symbol: "SOM" },
    rpcUrls: {
      default: { http: [rpcUrl] },
      public: { http: [rpcUrl] }
    }
  });

  const transport = http(rpcUrl, { timeout: 60000 });
  
  // Note: SDK needs wallet client but we only read, so use a dummy key (must be valid)
  const dummyKey = "0x1234567890123456789012345678901234567890123456789012345678901234";
  const account = privateKeyToAccount(dummyKey as `0x${string}`);

  const publicClient = createPublicClient({ chain, transport });
  const walletClient = createWalletClient({ account, chain, transport });
  const sdk = new SDK({ public: publicClient, wallet: walletClient });

  const schemaId = await sdk.streams.computeSchemaId(PRICE_SCHEMA);
  if (!schemaId) {
    throw new Error("Failed to compute schema ID");
  }

  const metrics: PriceMetric[] = [];
  const pairs = TRACKED_PAIRS as PairEntry[];

  for (const pair of pairs) {
    try {
      const dataKey = keccak256(
        encodeAbiParameters(
          parseAbiParameters('address, address, string'),
          [
            pair.baseAddress as `0x${string}`,
            pair.quoteAddress as `0x${string}`,
            pair.pairId
          ]
        )
      );

      const data = await sdk.streams.getByKey(
        schemaId,
        publisherAddress as `0x${string}`,
        dataKey
      );

      if (!data || !Array.isArray(data) || data.length === 0) {
        console.log(`No data found for pair ${pair.pairId}`);
        continue;
      }

      // Extract values from SDK's decoded structure
      const fields = data[0];
      const getValue = (name: string) => {
        const field = fields.find((f: any) => f.name === name);
        return field?.value?.value;
      };

      const timestamp = getValue('timestamp');
      const price = getValue('price');
      const delta = getValue('delta');
      const deltaBps = getValue('deltaBps');
      const decimals = getValue('feedDecimals') || 8;
      const priceFeed = getValue('priceFeed');

      if (!price) {
        console.log(`No price data for pair ${pair.pairId}`);
        continue;
      }

      const scale = Math.pow(10, Number(decimals));

      metrics.push({
        timestamp: Number(timestamp) || Math.floor(Date.now() / 1000),
        baseToken: pair.baseToken,
        quoteToken: pair.quoteToken,
        baseAddress: pair.baseAddress as HexAddress,
        quoteAddress: pair.quoteAddress as HexAddress,
        pairId: pair.pairId,
        source: pair.source,
        price: Number(price) / scale,
        priceDelta: Number(delta || 0) / scale,
        priceDeltaPercent: Number(deltaBps || 0) / 100,
        priceFeed: priceFeed || pair.feed
      });
    } catch (error) {
      console.error(`Failed to fetch data for pair ${pair.pairId}:`, error);
    }
  }

  return metrics;
}

export async function GET() {
  try {
    const metrics = await fetchMetricsFromSomnia();
    
    if (metrics.length === 0) {
      return NextResponse.json(
        { 
          error: "No metrics available",
          message: "Either no pairs are configured yet or the contract hasn't been triggered. Make sure the MetricsUpdater contract has been deployed and pairs have been initialized."
        },
        { status: 404 }
      );
    }

    return NextResponse.json({ metrics, timestamp: Date.now() });
  } catch (error) {
    console.error("Error fetching metrics:", error);
    return NextResponse.json(
      { 
        error: "Failed to fetch metrics",
        message: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}

// Enable revalidation
export const revalidate = 0; // Don't cache
export const dynamic = 'force-dynamic';
