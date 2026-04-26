import type { MarketKey } from "../types/market.js";

export const queryKeys = {
  health: () => ["health"] as const,
  fundingRates: (market: MarketKey) => ["funding-rates", market] as const,
  assetDetail: (base: string) => ["asset-detail", base] as const,
  assetHistoryMarket: (base: string, market: MarketKey, days: number) => ["asset-history", base, market, days] as const
};
