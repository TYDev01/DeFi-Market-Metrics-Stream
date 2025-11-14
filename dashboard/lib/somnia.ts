import { createPublicClient, http, decodeAbiParameters, Hex, keccak256, encodePacked } from "viem";
import { PriceMetric } from "./types";
import { TRACKED_PAIRS } from "../../shared/pairs.js";

type HexAddress = `0x${string}`;

type PairEntry = {
  baseToken: string;
  quoteToken: string;
  baseAddress: string;
  quoteAddress: string;
  pairId: string;
  source: string;
};

const SOMNIA_STREAM_ABI = [
  {
    name: "get",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "schemaId", type: "bytes32" },
      { name: "dataKey", type: "bytes32" }
    ],
    outputs: [
      { name: "encodedData", type: "bytes" },
      { name: "timestamp", type: "uint64" }
    ]
  }
] as const;

function computeDataKey(baseAddress: string, quoteAddress: string, pairId: string): Hex {
  return keccak256(
    encodePacked(["address", "address", "string"], [baseAddress as HexAddress, quoteAddress as HexAddress, pairId])
  );
}

const DEFAULT_SAMPLE_PAIRS = [
  {
    baseToken: "SOM",
    quoteToken: "USDT",
    baseAddress: "0x0000000000000000000000000000000000000001",
    quoteAddress: "0x0000000000000000000000000000000000000002",
    pairId: "SOM-USDT",
    source: "Chainlink"
  },
  {
    baseToken: "ETH",
    quoteToken: "USD",
    baseAddress: "0x0000000000000000000000000000000000000003",
    quoteAddress: "0x0000000000000000000000000000000000000004",
    pairId: "ETH-USD",
    source: "Chainlink"
  },
  {
    baseToken: "BTC",
    quoteToken: "USD",
    baseAddress: "0x0000000000000000000000000000000000000005",
    quoteAddress: "0x0000000000000000000000000000000000000004",
    pairId: "BTC-USD",
    source: "Chainlink"
  }
];

const CONFIGURED_PAIRS = (TRACKED_PAIRS.length > 0 ? TRACKED_PAIRS : DEFAULT_SAMPLE_PAIRS) as PairEntry[];

function getFallbackMetrics(): PriceMetric[] {
  const now = Math.floor(Date.now() / 1000);
  return CONFIGURED_PAIRS.map((pair, index) => ({
    timestamp: now - index * 600,
    baseToken: pair.baseToken,
    quoteToken: pair.quoteToken,
    baseAddress: pair.baseAddress as HexAddress,
    quoteAddress: pair.quoteAddress as HexAddress,
    pairId: pair.pairId,
    source: pair.source,
    price: 100 + index * 50,
    priceDelta: index === 0 ? 0 : 1.25 * index,
    priceDeltaPercent: index === 0 ? 0 : 0.5 * index,
    priceFeed: "0x0000000000000000000000000000000000000000"
  }));
}

export async function getInitialMetrics(): Promise<PriceMetric[]> {
  const rpcUrl = process.env.SOMNIA_RPC_URL;
  const streamAddress = process.env.SOMNIA_STREAM_ADDRESS;
  const schemaId = process.env.SOMNIA_SCHEMA_ID;

  if (!rpcUrl || !streamAddress || !schemaId) {
    return getFallbackMetrics();
  }

  const client = createPublicClient({
    transport: http(rpcUrl)
  });

  const metrics: PriceMetric[] = [];
  const pairs = CONFIGURED_PAIRS;

  for (const pair of pairs) {
    try {
      const dataKey = computeDataKey(pair.baseAddress, pair.quoteAddress, pair.pairId);

      const [encodedData, timestamp] = await client.readContract({
        address: streamAddress as Hex,
        abi: SOMNIA_STREAM_ABI,
        functionName: "get",
        args: [schemaId as Hex, dataKey]
      }) as unknown as [Hex, bigint];

      if (!encodedData || encodedData === "0x") {
        continue;
      }

      const decoded = decodeAbiParameters(
        [
          { type: "uint64", name: "timestamp" },
          { type: "string", name: "baseToken" },
          { type: "string", name: "quoteToken" },
          { type: "string", name: "pairId" },
          { type: "string", name: "source" },
          { type: "uint256", name: "price" },
          { type: "int256", name: "delta" },
          { type: "int256", name: "deltaBps" },
          { type: "address", name: "priceFeed" },
          { type: "uint8", name: "decimals" },
          { type: "address", name: "baseAddress" },
          { type: "address", name: "quoteAddress" }
        ],
        encodedData as Hex
      );

      const [
        rawTimestamp,
        baseToken,
        quoteToken,
        pairId,
        source,
        priceRaw,
        deltaRaw,
        deltaBpsRaw,
        priceFeed,
        decimals,
        baseAddress,
        quoteAddress
      ] = decoded;

      const decimalsNumber = Number(decimals);
      const safeDecimals = Math.min(decimalsNumber, 18);
      const scale = safeDecimals > 0 ? Number(10n ** BigInt(safeDecimals)) : 1;

      metrics.push({
        timestamp: Number(rawTimestamp ?? timestamp),
        baseToken,
        quoteToken,
        baseAddress: baseAddress as HexAddress,
        quoteAddress: quoteAddress as HexAddress,
        pairId,
        source,
        price: Number(priceRaw) / scale,
        priceDelta: Number(deltaRaw) / scale,
        priceDeltaPercent: Number(deltaBpsRaw) / 100,
        priceFeed
      });
    } catch (error) {
      console.error("Somnia read failed for pair", pair, error);
    }
  }

  return metrics.length > 0 ? metrics : getFallbackMetrics();
}
