export type MetricField =
  | "protocol"
  | "network"
  | "poolId"
  | "baseToken"
  | "quoteToken"
  | "tvlUsd"
  | "volume24hUsd"
  | "fees24hUsd"
  | "aprBps"
  | "timestamp";

export interface DefiMetric {
  timestamp: number;
  protocol: string;
  network: string;
  poolId: string;
  baseToken: string;
  quoteToken: string;
  tvlUsd: number;
  volume24hUsd: number;
  fees24hUsd: number;
  aprBps: number;
}

export interface FilterState {
  search: string;
  protocol: string;
  network: string;
  minAprPercent: number;
}
