import { createPublicClient, http, decodeAbiParameters, Hex, keccak256, encodePacked } from "viem";

export interface SomniaMetric {
  timestamp: number;
  baseToken: string;
  quoteToken: string;
  pairId: string;
  source: string;
  baseAddress: `0x${string}`;
  quoteAddress: `0x${string}`;
  price: bigint;
  priceDelta: bigint;
  priceDeltaPercent: number;
  priceFeed: string;
  decimals: number;
}

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

export function computeDataKey(baseAddress: `0x${string}`, quoteAddress: `0x${string}`, pairId: string): Hex {
  return keccak256(encodePacked(["address", "address", "string"], [baseAddress, quoteAddress, pairId]));
}

export async function fetchMetricsFromSomnia(
  rpcUrl: string,
  streamAddress: Hex,
  schemaId: Hex,
  pairs: Array<{ baseAddress: `0x${string}`; quoteAddress: `0x${string}`; pairId: string }>
): Promise<SomniaMetric[]> {
  const client = createPublicClient({
    transport: http(rpcUrl)
  });

  const metrics: SomniaMetric[] = [];

  for (const pair of pairs) {
    try {
      const dataKey = computeDataKey(pair.baseAddress, pair.quoteAddress, pair.pairId);

      const [encodedData, timestamp] = await client.readContract({
        address: streamAddress,
        abi: SOMNIA_STREAM_ABI,
        functionName: "get",
        args: [schemaId, dataKey]
      }) as unknown as [Hex, bigint];

      if (!encodedData || encodedData === "0x") {
        continue;
      }

      const decoded = decodeAbiParameters(
        [
          { type: "uint64" },
          { type: "string" },
          { type: "string" },
          { type: "string" },
          { type: "string" },
          { type: "uint256" },
          { type: "int256" },
          { type: "int256" },
          { type: "address" },
          { type: "uint8" },
          { type: "address" },
          { type: "address" }
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
        decimalsRaw,
        baseAddress,
        quoteAddress
      ] = decoded;

      metrics.push({
        timestamp: Number(rawTimestamp ?? timestamp),
        baseToken,
        quoteToken,
        pairId,
        source,
        price: priceRaw,
        priceDelta: deltaRaw,
        priceDeltaPercent: Number(deltaBpsRaw) / 100,
        priceFeed,
        decimals: Number(decimalsRaw),
        baseAddress: baseAddress as `0x${string}`,
        quoteAddress: quoteAddress as `0x${string}`
      });
    } catch (error) {
      console.error("Somnia pair read failed", pair, error);
    }
  }

  return metrics;
}
