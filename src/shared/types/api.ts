import type { AssetDetailRow, AssetFundingHistoryRow, FundingRow, MarketKey } from "./market.js";

export interface FundingRatesResponse {
  market: MarketKey;
  rows: FundingRow[];
  fetchedAt: number;
  sourceUrl: string;
}

export interface AssetDetailResponse {
  base: string;
  rows: AssetDetailRow[];
  fetchedAt: number;
}

export interface AssetFundingHistoryMarketResponse {
  base: string;
  market: MarketKey;
  days: number;
  row: AssetFundingHistoryRow;
  fetchedAt: number;
}

export interface HealthResponse {
  status: "ok";
  timestamp: number;
}
