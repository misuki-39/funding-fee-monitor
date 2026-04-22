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
  sourceLabel: string;
}

export interface AssetFundingHistoryResponse {
  base: string;
  days: number;
  rows: AssetFundingHistoryRow[];
  fetchedAt: number;
  sourceLabel: string;
}

export interface HealthResponse {
  status: "ok";
  timestamp: number;
}
