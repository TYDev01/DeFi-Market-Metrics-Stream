import { createPublicClient, http, decodeAbiParameters, Hex, keccak256, encodePacked } from "viem";

export interface SomniaMetric {
  timestamp: number;
  protocol: string;
  network: string;
  poolId: string;
  baseToken: string;
  quoteToken: string;
  tvlUsd: bigint;
  volume24hUsd: bigint;
  fees24hUsd: bigint;
  aprBps: bigint;
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

export function computeDataKey(protocol: string, network: string, poolId: string): Hex {
  return keccak256(encodePacked(["string", "string", "string"], [protocol, network, poolId]));
}

export async function fetchMetricsFromSomnia(
  rpcUrl: string,
  streamAddress: Hex,
  schemaId: Hex,
  pools: Array<{ protocol: string; network: string; poolId: string }>
): Promise<SomniaMetric[]> {
  const client = createPublicClient({
    transport: http(rpcUrl)
  });

  const metrics: SomniaMetric[] = [];

  for (const pool of pools) {
    const dataKey = computeDataKey(pool.protocol, pool.network, pool.poolId);

    const [encodedData, timestamp] = await client.readContract({
      address: streamAddress,
      abi: SOMNIA_STREAM_ABI,
      functionName: "get",
      args: [schemaId, dataKey]
    }) as unknown as [Hex, bigint];

    const decoded = decodeAbiParameters(
      [
        { type: "uint64" },
        { type: "string" },
        { type: "string" },
        { type: "string" },
        { type: "string" },
        { type: "string" },
        { type: "uint256" },
        { type: "uint256" },
        { type: "uint256" },
        { type: "int256" }
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
      tvlUsd,
      volume24hUsd,
      fees24hUsd,
      aprBps
    });
  }

  return metrics;
}
