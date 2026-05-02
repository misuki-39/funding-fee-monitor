import { formatCycle } from "../../src/shared/lib/formatters.js";
import type { AssetDetailMarketData, AssetFundingHistoryMarketData, AssetFundingHistoryPoint, FundingRow, PricePoint } from "../../src/shared/types/market.js";
import { getOrFetch } from "../lib/cache.js";
import { fetchUpstreamJson } from "../lib/upstream.js";

const metadataTtlMs = 4 * 60 * 60 * 1000;

const premiumIndexUrl = "https://fapi.asterdex.com/fapi/v3/premiumIndex";
const fundingInfoUrl = "https://fapi.asterdex.com/fapi/v3/fundingInfo";
const fundingRateHistoryUrl = "https://fapi.asterdex.com/fapi/v3/fundingRate";
const markPriceKlinesUrl = "https://fapi.asterdex.com/fapi/v3/markPriceKlines";

interface AsterPremiumIndexDto {
  symbol: string;
  lastFundingRate: string;
  nextFundingTime: number;
  markPrice: string;
}

interface AsterFundingInfoDto {
  symbol?: string | null;
  fundingIntervalHours: number;
}

interface AsterFundingRateHistoryDto {
  symbol: string;
  fundingRate: string;
  fundingTime: number;
}

function createAsterIntervalMap(fundingInfoRows: AsterFundingInfoDto[]): Map<string, number> {
  const intervalMap = new Map<string, number>();

  for (const item of fundingInfoRows) {
    if (!item.symbol || !Number.isInteger(item.fundingIntervalHours)) {
      continue;
    }

    intervalMap.set(item.symbol, item.fundingIntervalHours);
  }

  return intervalMap;
}

function getAsterIntervalHours(intervalMap: Map<string, number>, symbol: string): number {
  const intervalHours = intervalMap.get(symbol);

  if (intervalHours == null) {
    throw new Error(`Missing Aster funding interval for ${symbol}`);
  }

  return intervalHours;
}

export function normalizeAsterRow(raw: AsterPremiumIndexDto, intervalHours: number): FundingRow {
  const fundingRate = Number(raw.lastFundingRate);
  const settlementTimeMs = Number(raw.nextFundingTime);

  if (!raw.symbol || Number.isNaN(fundingRate) || Number.isNaN(settlementTimeMs)) {
    throw new Error(`Invalid Aster funding rate row: ${JSON.stringify(raw)}`);
  }

  if (!Number.isInteger(intervalHours)) {
    throw new Error(`Invalid Aster funding interval for ${raw.symbol}: ${intervalHours}`);
  }

  return {
    symbol: raw.symbol,
    fundingRate,
    cycleLabel: formatCycle(intervalHours),
    settlementTimeMs
  };
}

export function mergeAsterRows(
  premiumRows: AsterPremiumIndexDto[],
  fundingInfoRows: AsterFundingInfoDto[]
): FundingRow[] {
  const intervalMap = createAsterIntervalMap(fundingInfoRows);

  return premiumRows
    .filter((raw) => !raw.symbol.endsWith("USD1"))
    .filter((raw) => intervalMap.has(raw.symbol))
    .map((raw) => normalizeAsterRow(raw, getAsterIntervalHours(intervalMap, raw.symbol)));
}

export function normalizeAsterAssetDetail(raw: AsterPremiumIndexDto, intervalHours: number): AssetDetailMarketData {
  const fundingRate = Number(raw.lastFundingRate);
  const markPrice = Number(raw.markPrice);

  if (!raw.symbol || Number.isNaN(fundingRate) || Number.isNaN(markPrice)) {
    throw new Error(`Invalid Aster asset detail row: ${JSON.stringify(raw)}`);
  }

  if (!Number.isInteger(intervalHours)) {
    throw new Error(`Invalid Aster funding interval for ${raw.symbol}: ${intervalHours}`);
  }

  return {
    symbol: raw.symbol,
    fundingRate,
    markPrice,
    cycleLabel: formatCycle(intervalHours)
  };
}

export function normalizeAsterHistoryPoint(raw: AsterFundingRateHistoryDto): AssetFundingHistoryPoint {
  const fundingRate = Number(raw.fundingRate);
  const fundingTimeMs = Number(raw.fundingTime);

  if (!raw.symbol || Number.isNaN(fundingRate) || Number.isNaN(fundingTimeMs)) {
    throw new Error(`Invalid Aster funding history row: ${JSON.stringify(raw)}`);
  }

  return {
    fundingTimeMs,
    fundingRate
  };
}

// Aster markPriceKlines mirrors Binance: [openTime, open, high, low, close, ...]
type AsterKlineDto = [number, string, string, string, string, ...unknown[]];

function normalizeAsterKline(raw: AsterKlineDto): PricePoint {
  const timeMs = Number(raw[0]);
  const price = Number(raw[1]);

  if (Number.isNaN(timeMs) || Number.isNaN(price)) {
    throw new Error(`Invalid Aster kline: ${JSON.stringify(raw)}`);
  }

  return { timeMs, price };
}

async function fetchAsterFundingInfo(): Promise<AsterFundingInfoDto[]> {
  return getOrFetch("aster:fundingInfo", metadataTtlMs, async () => {
    const fundingInfoRows = await fetchUpstreamJson<AsterFundingInfoDto[]>(fundingInfoUrl, "Aster fundingInfo API");

    if (!Array.isArray(fundingInfoRows)) {
      throw new Error("Aster fundingInfo API returned an invalid payload");
    }

    return fundingInfoRows;
  });
}

export async function fetchAsterRows(): Promise<FundingRow[]> {
  const [premiumRows, fundingInfoRows] = await Promise.all([
    fetchUpstreamJson<AsterPremiumIndexDto[]>(premiumIndexUrl, "Aster premiumIndex API"),
    fetchAsterFundingInfo()
  ]);

  if (!Array.isArray(premiumRows)) {
    throw new Error("Aster premiumIndex API returned an invalid payload");
  }

  return mergeAsterRows(premiumRows, fundingInfoRows);
}

export async function fetchAsterAssetDetail(symbol: string): Promise<AssetDetailMarketData> {
  const [row, fundingInfoRows] = await Promise.all([
    fetchUpstreamJson<AsterPremiumIndexDto>(
      `${premiumIndexUrl}?symbol=${encodeURIComponent(symbol)}`,
      "Aster premiumIndex detail API"
    ),
    fetchAsterFundingInfo()
  ]);

  if (!row || Array.isArray(row)) {
    throw new Error("Aster premiumIndex detail API returned an invalid payload");
  }

  const intervalMap = createAsterIntervalMap(fundingInfoRows);

  return normalizeAsterAssetDetail(row, getAsterIntervalHours(intervalMap, symbol));
}

export async function fetchAsterAssetHistory(
  symbol: string,
  startTimeMs: number,
  endTimeMs: number
): Promise<AssetFundingHistoryMarketData> {
  const [fundingRows, klineRows] = await Promise.all([
    fetchUpstreamJson<AsterFundingRateHistoryDto[]>(
      `${fundingRateHistoryUrl}?symbol=${encodeURIComponent(symbol)}&startTime=${startTimeMs}&endTime=${endTimeMs}&limit=1000`,
      "Aster fundingRate history API"
    ),
    fetchUpstreamJson<AsterKlineDto[]>(
      `${markPriceKlinesUrl}?symbol=${encodeURIComponent(symbol)}&interval=15m&startTime=${startTimeMs}&endTime=${endTimeMs}&limit=1500`,
      "Aster markPriceKlines API"
    )
  ]);

  if (!Array.isArray(fundingRows)) {
    throw new Error("Aster fundingRate history API returned an invalid payload");
  }

  if (!Array.isArray(klineRows)) {
    throw new Error("Aster markPriceKlines API returned an invalid payload");
  }

  const points = fundingRows
    .map(normalizeAsterHistoryPoint)
    .filter((point) => point.fundingTimeMs >= startTimeMs && point.fundingTimeMs <= endTimeMs)
    .sort((left, right) => left.fundingTimeMs - right.fundingTimeMs);

  const pricePoints = klineRows
    .map(normalizeAsterKline)
    .filter((point) => point.timeMs >= startTimeMs && point.timeMs <= endTimeMs)
    .sort((left, right) => left.timeMs - right.timeMs);

  return {
    symbol,
    points,
    pricePoints
  };
}
