export type PairDefinition = {
  baseToken: string;
  quoteToken: string;
  baseAddress: `0x${string}`;
  quoteAddress: `0x${string}`;
  pairId: string;
  source: string;
  feed?: `0x${string}`;
  network?: string;
  rpcUrl?: string;
};

export const TRACKED_PAIRS: PairDefinition[];



