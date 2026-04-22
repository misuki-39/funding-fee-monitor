import type { MarketKey } from "../types/market.js";

export const queryKeys = {
  health: () => ["health"] as const,
  fundingRates: (market: MarketKey) => ["funding-rates", market] as const,
  assetDetail: (base: string) => ["asset-detail", base] as const,
  assetHistory: (base: string, days: number) => ["asset-history", base, days] as const
};
