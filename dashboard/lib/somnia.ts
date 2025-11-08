import { createPublicClient, http, decodeAbiParameters, Hex, keccak256, encodePacked } from "viem";
import { DefiMetric } from "./types";

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

const DEFAULT_POOLS = [
  {
    protocol: "SomniaSwap",
    network: "Somnia",
    poolId: "ETH-USD",
    baseToken: "ETH",
    quoteToken: "USD"
  },
  {
    protocol: "SomniaLend",
    network: "Somnia",
    poolId: "sETH",
    baseToken: "sETH",
    quoteToken: "USD"
  },
  {
    protocol: "SomniaYield",
    network: "Somnia",
    poolId: "Vault-01",
    baseToken: "ETH",
    quoteToken: "stETH"
  }
] satisfies Array<Pick<DefiMetric, "protocol" | "network" | "poolId" | "baseToken" | "quoteToken">>;

function computeDataKey(protocol: string, network: string, poolId: string): Hex {
  const composite = `${protocol}:${network}:${poolId}`;
  return keccak256(encodePacked(["string"], [composite]));
}

function getFallbackMetrics(): DefiMetric[] {
  const now = Math.floor(Date.now() / 1000);
  return DEFAULT_POOLS.map((pool, index) => ({
    ...pool,
    timestamp: now - index * 900,
    tvlUsd: 3_000_000 + index * 125_000,
    volume24hUsd: 480_000 + index * 40_000,
    fees24hUsd: 9_200 + index * 750,
    aprBps: 875 + index * 45
  }));
}

export async function getInitialMetrics(): Promise<DefiMetric[]> {
  const rpcUrl = process.env.SOMNIA_RPC_URL;
  const streamAddress = process.env.SOMNIA_STREAM_ADDRESS;
  const schemaId = process.env.SOMNIA_SCHEMA_ID;

  if (!rpcUrl || !streamAddress || !schemaId) {
    return getFallbackMetrics();
  }

  const client = createPublicClient({
    transport: http(rpcUrl)
  });

  const metrics: DefiMetric[] = [];

  for (const pool of DEFAULT_POOLS) {
    try {
      const dataKey = computeDataKey(pool.protocol, pool.network, pool.poolId);

      const [encodedData, timestamp] = await client.readContract({
        address: streamAddress as Hex,
        abi: SOMNIA_STREAM_ABI,
        functionName: "get",
        args: [schemaId as Hex, dataKey]
      }) as unknown as [Hex, bigint];

      const decoded = decodeAbiParameters(
        [
          { type: "uint64", name: "timestamp" },
          { type: "string", name: "protocol" },
          { type: "string", name: "network" },
          { type: "string", name: "poolId" },
          { type: "string", name: "baseToken" },
          { type: "string", name: "quoteToken" },
          { type: "uint256", name: "tvlUsd" },
          { type: "uint256", name: "volume24hUsd" },
          { type: "uint256", name: "fees24hUsd" },
          { type: "int256", name: "aprBps" }
        ],
        encodedData as Hex
      ) as [bigint, string, string, string, string, string, bigint, bigint, bigint, bigint];

      const [
        rawTimestamp,
        protocol,
        network,
        poolId,
        baseToken,
        quoteToken,
        tvlUsd,
        volume24hUsd,
        fees24hUsd,
        aprBps
      ] = decoded;

      metrics.push({
        timestamp: Number(rawTimestamp ?? timestamp),
        protocol,
        network,
        poolId,
        baseToken,
        quoteToken,
        tvlUsd: Number(tvlUsd),
        volume24hUsd: Number(volume24hUsd),
        fees24hUsd: Number(fees24hUsd),
        aprBps: Number(aprBps)
      });
    } catch (error) {
      console.error("Somnia read failed", error);
      return getFallbackMetrics();
    }
  }

  return metrics.length > 0 ? metrics : getFallbackMetrics();
}
