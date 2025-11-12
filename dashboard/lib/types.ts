export type MetricField =
  | "pairId"
  | "baseToken"
  | "quoteToken"
  | "source"
  | "price"
  | "priceDelta"
  | "priceDeltaPercent"
  | "timestamp";

export interface PriceMetric {
  timestamp: number;
  baseToken: string;
  quoteToken: string;
  baseAddress: `0x${string}`;
  quoteAddress: `0x${string}`;
  pairId: string;
  source: string;
  price: number;
  priceDelta: number;
  priceDeltaPercent: number;
  priceFeed: string;
}

export interface FilterState {
  search: string;
  source: string;
  minChangePercent: number;
}
