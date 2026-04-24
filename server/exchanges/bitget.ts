import { formatCycle } from "../../src/shared/lib/formatters.js";
import type {
  AssetDetailMarketData,
  AssetFundingHistoryMarketData,
  AssetFundingHistoryPoint,
  FundingRow,
  PricePoint
} from "../../src/shared/types/market.js";
import { fetchUpstreamJson } from "../lib/upstream.js";

const bitgetProductType = "usdt-futures";
const currentFundingRateUrl = "https://api.bitget.com/api/v2/mix/market/current-fund-rate";
const historicalFundingRateUrl = "https://api.bitget.com/api/v2/mix/market/history-fund-rate";
const symbolPriceUrl = "https://api.bitget.com/api/v2/mix/market/symbol-price";
const candlesUrl = "https://api.bitget.com/api/v2/mix/market/candles";
const historyPageSize = 100;
const candleLimit = 1000;

interface BitgetEnvelope<T> {
  code: string;
  msg: string;
  requestTime: number;
  data: T;
}

interface BitgetCurrentFundingDto {
  symbol: string;
  fundingRate: string;
  fundingRateInterval: string;
  nextUpdate: string;
}

interface BitgetFundingHistoryDto {
  symbol: string;
  fundingRate: string;
  fundingTime: string;
}

interface BitgetSymbolPriceDto {
  symbol: string;
  markPrice: string;
}

type BitgetCandleDto = [string, string, string, string, string, string, string];

function assertBitgetSuccess<T>(envelope: BitgetEnvelope<T>, label: string): T {
  if (envelope.code !== "00000") {
    throw new Error(`${label} failed: code=${envelope.code}, msg=${envelope.msg}`);
  }

  return envelope.data;
}

export function normalizeBitgetRow(raw: BitgetCurrentFundingDto): FundingRow {
  const fundingRate = Number(raw.fundingRate);
  const intervalHours = Number(raw.fundingRateInterval);
  const settlementTimeMs = Number(raw.nextUpdate);

  if (!raw.symbol || Number.isNaN(fundingRate) || Number.isNaN(intervalHours) || Number.isNaN(settlementTimeMs)) {
    throw new Error(`Invalid Bitget funding rate row: ${JSON.stringify(raw)}`);
  }

  return {
    symbol: raw.symbol,
    fundingRate,
    cycleLabel: formatCycle(intervalHours),
    settlementTimeMs
  };
}

export function normalizeBitgetAssetDetail(
  fundingRaw: BitgetCurrentFundingDto,
  priceRaw: BitgetSymbolPriceDto
): AssetDetailMarketData {
  const fundingRate = Number(fundingRaw.fundingRate);
  const markPrice = Number(priceRaw.markPrice);
  const intervalHours = Number(fundingRaw.fundingRateInterval);

  if (
    !fundingRaw.symbol ||
    fundingRaw.symbol !== priceRaw.symbol ||
    Number.isNaN(fundingRate) ||
    Number.isNaN(markPrice) ||
    Number.isNaN(intervalHours)
  ) {
    throw new Error(`Invalid Bitget asset detail payload: funding=${JSON.stringify(fundingRaw)} price=${JSON.stringify(priceRaw)}`);
  }

  return {
    symbol: fundingRaw.symbol,
    fundingRate,
    markPrice,
    cycleLabel: formatCycle(intervalHours)
  };
}

export function normalizeBitgetFundingHistoryPoint(raw: BitgetFundingHistoryDto): AssetFundingHistoryPoint {
  const fundingRate = Number(raw.fundingRate);
  const fundingTimeMs = Number(raw.fundingTime);

  if (!raw.symbol || Number.isNaN(fundingRate) || Number.isNaN(fundingTimeMs)) {
    throw new Error(`Invalid Bitget funding history row: ${JSON.stringify(raw)}`);
  }

  return {
    fundingTimeMs,
    fundingRate
  };
}

export function normalizeBitgetCandle(raw: BitgetCandleDto): PricePoint {
  const timeMs = Number(raw[0]);
  const price = Number(raw[1]);

  if (Number.isNaN(timeMs) || Number.isNaN(price)) {
    throw new Error(`Invalid Bitget candle: ${JSON.stringify(raw)}`);
  }

  return { timeMs, price };
}

function createBitgetSearchParams(params: Record<string, string | number>) {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    searchParams.set(key, String(value));
  }

  return searchParams.toString();
}

async function fetchBitgetCurrentFunding(symbol?: string) {
  const search = createBitgetSearchParams({
    productType: bitgetProductType,
    ...(symbol ? { symbol } : {})
  });
  const envelope = await fetchUpstreamJson<BitgetEnvelope<BitgetCurrentFundingDto[]>>(
    `${currentFundingRateUrl}?${search}`,
    "Bitget current funding rate API"
  );

  const data = assertBitgetSuccess(envelope, "Bitget current funding rate API");

  if (!Array.isArray(data)) {
    throw new Error("Bitget current funding rate API returned an invalid payload");
  }

  return data;
}

async function fetchBitgetFundingHistory(
  symbol: string,
  startTimeMs: number,
  endTimeMs: number
): Promise<AssetFundingHistoryPoint[]> {
  const points: AssetFundingHistoryPoint[] = [];

  for (let pageNo = 1; ; pageNo += 1) {
    const search = createBitgetSearchParams({
      symbol,
      productType: bitgetProductType,
      pageSize: historyPageSize,
      pageNo
    });
    const envelope = await fetchUpstreamJson<BitgetEnvelope<BitgetFundingHistoryDto[]>>(
      `${historicalFundingRateUrl}?${search}`,
      "Bitget funding rate history API"
    );
    const data = assertBitgetSuccess(envelope, "Bitget funding rate history API");

    if (!Array.isArray(data) || data.length === 0) {
      break;
    }

    const batch = data.map(normalizeBitgetFundingHistoryPoint);
    points.push(...batch);

    const oldestTime = Math.min(...batch.map((point) => point.fundingTimeMs));
    if (oldestTime <= startTimeMs || data.length < historyPageSize) {
      break;
    }
  }

  return [...new Map(
    points
      .filter((point) => point.fundingTimeMs >= startTimeMs && point.fundingTimeMs <= endTimeMs)
      .map((point) => [point.fundingTimeMs, point] as const)
  ).values()].sort((left, right) => left.fundingTimeMs - right.fundingTimeMs);
}

async function fetchBitgetMarkPriceHistory(
  symbol: string,
  startTimeMs: number,
  endTimeMs: number
): Promise<PricePoint[]> {
  const candles: PricePoint[] = [];
  let currentEndTimeMs = endTimeMs;

  while (true) {
    const search = createBitgetSearchParams({
      symbol,
      productType: bitgetProductType,
      granularity: "15m",
      kLineType: "MARK",
      endTime: currentEndTimeMs,
      limit: candleLimit
    });
    const envelope = await fetchUpstreamJson<BitgetEnvelope<BitgetCandleDto[]>>(
      `${candlesUrl}?${search}`,
      "Bitget candles API"
    );
    const data = assertBitgetSuccess(envelope, "Bitget candles API");

    if (!Array.isArray(data) || data.length === 0) {
      break;
    }

    const batch = data.map(normalizeBitgetCandle);
    candles.push(...batch);

    const oldestTime = Math.min(...batch.map((point) => point.timeMs));
    if (oldestTime <= startTimeMs || data.length < candleLimit) {
      break;
    }

    currentEndTimeMs = oldestTime - 1;
  }

  return [...new Map(
    candles
      .filter((point) => point.timeMs >= startTimeMs && point.timeMs <= endTimeMs)
      .map((point) => [point.timeMs, point] as const)
  ).values()].sort((left, right) => left.timeMs - right.timeMs);
}

export async function fetchBitgetRows(): Promise<FundingRow[]> {
  const rows = await fetchBitgetCurrentFunding();
  return rows.map(normalizeBitgetRow);
}

export async function fetchBitgetAssetDetail(symbol: string): Promise<AssetDetailMarketData> {
  const [fundingRows, priceEnvelope] = await Promise.all([
    fetchBitgetCurrentFunding(symbol),
    fetchUpstreamJson<BitgetEnvelope<BitgetSymbolPriceDto[]>>(
      `${symbolPriceUrl}?${createBitgetSearchParams({ productType: bitgetProductType, symbol })}`,
      "Bitget symbol price API"
    )
  ]);

  const priceRows = assertBitgetSuccess(priceEnvelope, "Bitget symbol price API");

  if (!Array.isArray(priceRows)) {
    throw new Error("Bitget symbol price API returned an invalid payload");
  }

  const fundingRaw = fundingRows[0];
  const priceRaw = priceRows[0];

  if (!fundingRaw || !priceRaw) {
    throw new Error(`Bitget asset detail not found for ${symbol}`);
  }

  return normalizeBitgetAssetDetail(fundingRaw, priceRaw);
}

export async function fetchBitgetAssetHistory(
  symbol: string,
  startTimeMs: number,
  endTimeMs: number
): Promise<AssetFundingHistoryMarketData> {
  const [points, pricePoints] = await Promise.all([
    fetchBitgetFundingHistory(symbol, startTimeMs, endTimeMs),
    fetchBitgetMarkPriceHistory(symbol, startTimeMs, endTimeMs)
  ]);

  return {
    symbol,
    points,
    pricePoints
  };
}
