export type MarketKey = "okx" | "binance" | "gate" | "bitget";
export type SortDirection = "asc" | "desc";
export type CycleLabel = "1h" | "2h" | "4h" | "8h";
export type SettlementFilter = "1h" | "4h" | "all";

export interface FundingRow {
  symbol: string;
  fundingRate: number;
  cycleLabel: CycleLabel;
  settlementTimeMs: number;
}

export interface AssetDetailMarketData {
  symbol: string;
  fundingRate: number;
  markPrice: number;
  cycleLabel: CycleLabel;
}

export interface AssetFundingHistoryPoint {
  fundingTimeMs: number;
  fundingRate: number;
}

export interface PricePoint {
  timeMs: number;
  price: number;
}

export interface AssetFundingHistoryMarketData {
  symbol: string;
  points: AssetFundingHistoryPoint[];
  pricePoints: PricePoint[];
}

export interface AssetDetailRow {
  market: MarketKey;
  base: string;
  symbol: string;
  fundingRate: number | null;
  markPrice: number | null;
  cycleLabel: CycleLabel | null;
  available: boolean;
  errorMessage: string | null;
}

export interface AssetFundingHistoryRow {
  market: MarketKey;
  base: string;
  symbol: string;
  points: AssetFundingHistoryPoint[];
  pricePoints: PricePoint[];
  available: boolean;
  errorMessage: string | null;
}

export interface MarketConfig {
  key: MarketKey;
  label: string;
  title: string;
  sourceUrl: string;
}
