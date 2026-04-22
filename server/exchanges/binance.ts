import { formatCycle } from "../../src/shared/lib/formatters.js";
import type { AssetDetailMarketData, AssetFundingHistoryMarketData, AssetFundingHistoryPoint, FundingRow, PricePoint } from "../../src/shared/types/market.js";
import { fetchUpstreamJson } from "../lib/upstream.js";

const premiumIndexUrl = "https://fapi.binance.com/fapi/v1/premiumIndex";
const fundingInfoUrl = "https://fapi.binance.com/fapi/v1/fundingInfo";
const fundingRateHistoryUrl = "https://fapi.binance.com/fapi/v1/fundingRate";
const markPriceKlinesUrl = "https://fapi.binance.com/fapi/v1/markPriceKlines";

interface BinancePremiumIndexDto {
  symbol: string;
  lastFundingRate: string;
  nextFundingTime: number;
  markPrice: string;
}

interface BinanceFundingInfoDto {
  symbol?: string | null;
  fundingIntervalHours: number;
}

interface BinanceFundingRateHistoryDto {
  symbol: string;
  fundingRate: string;
  fundingTime: number;
  markPrice: string;
}

function createBinanceIntervalMap(fundingInfoRows: BinanceFundingInfoDto[]): Map<string, number> {
  const intervalMap = new Map<string, number>();

  for (const item of fundingInfoRows) {
    if (!item.symbol || !Number.isInteger(item.fundingIntervalHours)) {
      continue;
    }

    intervalMap.set(item.symbol, item.fundingIntervalHours);
  }

  return intervalMap;
}

function getBinanceIntervalHours(intervalMap: Map<string, number>, symbol: string): number {
  const intervalHours = intervalMap.get(symbol);

  if (intervalHours == null) {
    throw new Error(`Missing Binance funding interval for ${symbol}`);
  }

  return intervalHours;
}

export function normalizeBinanceRow(raw: BinancePremiumIndexDto, intervalHours: number): FundingRow {
  const fundingRate = Number(raw.lastFundingRate);
  const settlementTimeMs = Number(raw.nextFundingTime);

  if (!raw.symbol || Number.isNaN(fundingRate) || Number.isNaN(settlementTimeMs)) {
    throw new Error(`Invalid Binance funding rate row: ${JSON.stringify(raw)}`);
  }

  if (!Number.isInteger(intervalHours)) {
    throw new Error(`Invalid Binance funding interval for ${raw.symbol}: ${intervalHours}`);
  }

  return {
    symbol: raw.symbol,
    fundingRate,
    cycleLabel: formatCycle(intervalHours),
    settlementTimeMs
  };
}

export function mergeBinanceRows(
  premiumRows: BinancePremiumIndexDto[],
  fundingInfoRows: BinanceFundingInfoDto[]
): FundingRow[] {
  const intervalMap = createBinanceIntervalMap(fundingInfoRows);

  return premiumRows
    .filter((raw) => intervalMap.has(raw.symbol))
    .map((raw) => normalizeBinanceRow(raw, getBinanceIntervalHours(intervalMap, raw.symbol)));
}

export function normalizeBinanceAssetDetail(raw: BinancePremiumIndexDto, intervalHours: number): AssetDetailMarketData {
  const fundingRate = Number(raw.lastFundingRate);
  const markPrice = Number(raw.markPrice);

  if (!raw.symbol || Number.isNaN(fundingRate) || Number.isNaN(markPrice)) {
    throw new Error(`Invalid Binance asset detail row: ${JSON.stringify(raw)}`);
  }

  if (!Number.isInteger(intervalHours)) {
    throw new Error(`Invalid Binance funding interval for ${raw.symbol}: ${intervalHours}`);
  }

  return {
    symbol: raw.symbol,
    fundingRate,
    markPrice,
    cycleLabel: formatCycle(intervalHours)
  };
}

export function normalizeBinanceHistoryPoint(raw: BinanceFundingRateHistoryDto): AssetFundingHistoryPoint {
  const fundingRate = Number(raw.fundingRate);
  const fundingTimeMs = Number(raw.fundingTime);

  if (!raw.symbol || Number.isNaN(fundingRate) || Number.isNaN(fundingTimeMs)) {
    throw new Error(`Invalid Binance funding history row: ${JSON.stringify(raw)}`);
  }

  return {
    fundingTimeMs,
    fundingRate
  };
}

// Binance markPriceKlines returns: [openTime, open, high, low, close, ...]
type BinanceKlineDto = [number, string, string, string, string, ...unknown[]];

function normalizeBinanceKline(raw: BinanceKlineDto): PricePoint {
  const timeMs = Number(raw[0]);
  const price = Number(raw[1]); // open price

  if (Number.isNaN(timeMs) || Number.isNaN(price)) {
    throw new Error(`Invalid Binance kline: ${JSON.stringify(raw)}`);
  }

  return { timeMs, price };
}

export async function fetchBinanceRows(): Promise<FundingRow[]> {
  const [premiumRows, fundingInfoRows] = await Promise.all([
    fetchUpstreamJson<BinancePremiumIndexDto[]>(premiumIndexUrl, "Binance premiumIndex API"),
    fetchUpstreamJson<BinanceFundingInfoDto[]>(fundingInfoUrl, "Binance fundingInfo API")
  ]);

  if (!Array.isArray(premiumRows)) {
    throw new Error("Binance premiumIndex API returned an invalid payload");
  }

  if (!Array.isArray(fundingInfoRows)) {
    throw new Error("Binance fundingInfo API returned an invalid payload");
  }

  return mergeBinanceRows(premiumRows, fundingInfoRows);
}

export async function fetchBinanceAssetDetail(symbol: string): Promise<AssetDetailMarketData> {
  const [row, fundingInfoRows] = await Promise.all([
    fetchUpstreamJson<BinancePremiumIndexDto>(
      `${premiumIndexUrl}?symbol=${encodeURIComponent(symbol)}`,
      "Binance premiumIndex detail API"
    ),
    fetchUpstreamJson<BinanceFundingInfoDto[]>(fundingInfoUrl, "Binance fundingInfo API")
  ]);

  if (!row || Array.isArray(row)) {
    throw new Error("Binance premiumIndex detail API returned an invalid payload");
  }

  if (!Array.isArray(fundingInfoRows)) {
    throw new Error("Binance fundingInfo API returned an invalid payload");
  }

  const intervalMap = createBinanceIntervalMap(fundingInfoRows);

  return normalizeBinanceAssetDetail(row, getBinanceIntervalHours(intervalMap, symbol));
}

export async function fetchBinanceAssetHistory(
  symbol: string,
  startTimeMs: number,
  endTimeMs: number
): Promise<AssetFundingHistoryMarketData> {
  const [fundingRows, klineRows] = await Promise.all([
    fetchUpstreamJson<BinanceFundingRateHistoryDto[]>(
      `${fundingRateHistoryUrl}?symbol=${encodeURIComponent(symbol)}&startTime=${startTimeMs}&endTime=${endTimeMs}&limit=1000`,
      "Binance fundingRate history API"
    ),
    fetchUpstreamJson<BinanceKlineDto[]>(
      `${markPriceKlinesUrl}?symbol=${encodeURIComponent(symbol)}&interval=15m&startTime=${startTimeMs}&endTime=${endTimeMs}&limit=1500`,
      "Binance markPriceKlines API"
    )
  ]);

  if (!Array.isArray(fundingRows)) {
    throw new Error("Binance fundingRate history API returned an invalid payload");
  }

  if (!Array.isArray(klineRows)) {
    throw new Error("Binance markPriceKlines API returned an invalid payload");
  }

  const points = fundingRows
    .map(normalizeBinanceHistoryPoint)
    .filter((point) => point.fundingTimeMs >= startTimeMs && point.fundingTimeMs <= endTimeMs)
    .sort((left, right) => left.fundingTimeMs - right.fundingTimeMs);

  const pricePoints = klineRows
    .map(normalizeBinanceKline)
    .filter((point) => point.timeMs >= startTimeMs && point.timeMs <= endTimeMs)
    .sort((left, right) => left.timeMs - right.timeMs);

  return {
    symbol,
    points,
    pricePoints
  };
}
