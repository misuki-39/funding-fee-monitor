import { formatCycle } from "../../src/shared/lib/formatters.js";
import type {
  AssetDetailMarketData,
  AssetFundingHistoryMarketData,
  AssetFundingHistoryPoint,
  FundingRow,
  PricePoint
} from "../../src/shared/types/market.js";
import { fetchUpstreamJson } from "../lib/upstream.js";

const bybitCategory = "linear";
const tickersUrl = "https://api.bybit.com/v5/market/tickers";
const instrumentsInfoUrl = "https://api.bybit.com/v5/market/instruments-info";
const fundingHistoryUrl = "https://api.bybit.com/v5/market/funding/history";
const markPriceKlineUrl = "https://api.bybit.com/v5/market/mark-price-kline";
const fundingHistoryLimit = 200;
const candleLimit = 1000;
const candleIntervalMinutes = 15;

interface BybitEnvelope<T> {
  retCode: number;
  retMsg: string;
  result: { list: T[] } & Record<string, unknown>;
  time?: number;
}

interface BybitTickerDto {
  symbol: string;
  fundingRate: string;
  nextFundingTime: string;
  markPrice: string;
}

interface BybitInstrumentInfoDto {
  symbol?: string | null;
  fundingInterval?: number | null;
}

interface BybitFundingHistoryDto {
  symbol: string;
  fundingRate: string;
  fundingRateTimestamp: string;
}

type BybitMarkKlineDto = [string, string, string, string, string];

function assertBybitSuccess<T>(envelope: BybitEnvelope<T>, label: string): T[] {
  if (envelope.retCode !== 0) {
    throw new Error(`${label} failed: code=${envelope.retCode}, msg=${envelope.retMsg}`);
  }

  if (!envelope.result || !Array.isArray(envelope.result.list)) {
    throw new Error(`${label} returned an invalid payload`);
  }

  return envelope.result.list;
}

function createBybitSearchParams(params: Record<string, string | number>) {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    searchParams.set(key, String(value));
  }

  return searchParams.toString();
}

export function createBybitIntervalMap(rows: BybitInstrumentInfoDto[]): Map<string, number> {
  const intervalMap = new Map<string, number>();

  for (const item of rows) {
    if (!item.symbol || typeof item.fundingInterval !== "number" || item.fundingInterval <= 0) {
      continue;
    }

    intervalMap.set(item.symbol, item.fundingInterval / 60);
  }

  return intervalMap;
}

function getBybitIntervalHours(intervalMap: Map<string, number>, symbol: string): number {
  const intervalHours = intervalMap.get(symbol);

  if (intervalHours == null) {
    throw new Error(`Missing Bybit funding interval for ${symbol}`);
  }

  return intervalHours;
}

export function normalizeBybitRow(raw: BybitTickerDto, intervalHours: number): FundingRow {
  const fundingRate = Number(raw.fundingRate);
  const settlementTimeMs = Number(raw.nextFundingTime);

  if (!raw.symbol || Number.isNaN(fundingRate) || Number.isNaN(settlementTimeMs)) {
    throw new Error(`Invalid Bybit funding rate row: ${JSON.stringify(raw)}`);
  }

  return {
    symbol: raw.symbol,
    fundingRate,
    cycleLabel: formatCycle(intervalHours),
    settlementTimeMs
  };
}

export function normalizeBybitAssetDetail(raw: BybitTickerDto, intervalHours: number): AssetDetailMarketData {
  const fundingRate = Number(raw.fundingRate);
  const markPrice = Number(raw.markPrice);

  if (!raw.symbol || Number.isNaN(fundingRate) || Number.isNaN(markPrice)) {
    throw new Error(`Invalid Bybit asset detail row: ${JSON.stringify(raw)}`);
  }

  return {
    symbol: raw.symbol,
    fundingRate,
    markPrice,
    cycleLabel: formatCycle(intervalHours)
  };
}

export function normalizeBybitFundingHistoryPoint(raw: BybitFundingHistoryDto): AssetFundingHistoryPoint {
  const fundingRate = Number(raw.fundingRate);
  const fundingTimeMs = Number(raw.fundingRateTimestamp);

  if (!raw.symbol || Number.isNaN(fundingRate) || Number.isNaN(fundingTimeMs)) {
    throw new Error(`Invalid Bybit funding history row: ${JSON.stringify(raw)}`);
  }

  return {
    fundingTimeMs,
    fundingRate
  };
}

export function normalizeBybitCandle(raw: BybitMarkKlineDto): PricePoint {
  const timeMs = Number(raw[0]);
  const price = Number(raw[1]);

  if (Number.isNaN(timeMs) || Number.isNaN(price)) {
    throw new Error(`Invalid Bybit candle: ${JSON.stringify(raw)}`);
  }

  return { timeMs, price };
}

async function fetchBybitTickers(symbol?: string): Promise<BybitTickerDto[]> {
  const search = createBybitSearchParams({
    category: bybitCategory,
    ...(symbol ? { symbol } : {})
  });
  const envelope = await fetchUpstreamJson<BybitEnvelope<BybitTickerDto>>(
    `${tickersUrl}?${search}`,
    "Bybit tickers API"
  );

  return assertBybitSuccess(envelope, "Bybit tickers API");
}

async function fetchBybitInstrumentsInfo(symbol?: string): Promise<BybitInstrumentInfoDto[]> {
  const search = createBybitSearchParams({
    category: bybitCategory,
    ...(symbol ? { symbol } : {})
  });
  const envelope = await fetchUpstreamJson<BybitEnvelope<BybitInstrumentInfoDto>>(
    `${instrumentsInfoUrl}?${search}`,
    "Bybit instruments-info API"
  );

  return assertBybitSuccess(envelope, "Bybit instruments-info API");
}

async function fetchBybitFundingHistory(
  symbol: string,
  startTimeMs: number,
  endTimeMs: number
): Promise<AssetFundingHistoryPoint[]> {
  const points: AssetFundingHistoryPoint[] = [];
  let currentEndTimeMs = endTimeMs;

  while (true) {
    const search = createBybitSearchParams({
      category: bybitCategory,
      symbol,
      startTime: startTimeMs,
      endTime: currentEndTimeMs,
      limit: fundingHistoryLimit
    });
    const envelope = await fetchUpstreamJson<BybitEnvelope<BybitFundingHistoryDto>>(
      `${fundingHistoryUrl}?${search}`,
      "Bybit funding history API"
    );
    const data = assertBybitSuccess(envelope, "Bybit funding history API");

    if (data.length === 0) {
      break;
    }

    const batch = data.map(normalizeBybitFundingHistoryPoint);
    points.push(...batch);

    const oldestTime = Math.min(...batch.map((point) => point.fundingTimeMs));
    if (oldestTime <= startTimeMs || data.length < fundingHistoryLimit) {
      break;
    }

    currentEndTimeMs = oldestTime - 1;
  }

  return [...new Map(
    points
      .filter((point) => point.fundingTimeMs >= startTimeMs && point.fundingTimeMs <= endTimeMs)
      .map((point) => [point.fundingTimeMs, point] as const)
  ).values()].sort((left, right) => left.fundingTimeMs - right.fundingTimeMs);
}

async function fetchBybitMarkPriceHistory(
  symbol: string,
  startTimeMs: number,
  endTimeMs: number
): Promise<PricePoint[]> {
  const candles: PricePoint[] = [];
  let currentEndTimeMs = endTimeMs;

  while (true) {
    const search = createBybitSearchParams({
      category: bybitCategory,
      symbol,
      interval: candleIntervalMinutes,
      start: startTimeMs,
      end: currentEndTimeMs,
      limit: candleLimit
    });
    const envelope = await fetchUpstreamJson<BybitEnvelope<BybitMarkKlineDto>>(
      `${markPriceKlineUrl}?${search}`,
      "Bybit mark-price-kline API"
    );
    const data = assertBybitSuccess(envelope, "Bybit mark-price-kline API");

    if (data.length === 0) {
      break;
    }

    const batch = data.map(normalizeBybitCandle);
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

export async function fetchBybitRows(): Promise<FundingRow[]> {
  const [tickers, instruments] = await Promise.all([
    fetchBybitTickers(),
    fetchBybitInstrumentsInfo()
  ]);
  const intervalMap = createBybitIntervalMap(instruments);

  return tickers
    .filter((ticker) => intervalMap.has(ticker.symbol) && ticker.fundingRate !== "" && ticker.nextFundingTime !== "")
    .map((ticker) => normalizeBybitRow(ticker, getBybitIntervalHours(intervalMap, ticker.symbol)));
}

export async function fetchBybitAssetDetail(symbol: string): Promise<AssetDetailMarketData> {
  const [tickers, instruments] = await Promise.all([
    fetchBybitTickers(symbol),
    fetchBybitInstrumentsInfo(symbol)
  ]);

  const ticker = tickers[0];

  if (!ticker) {
    throw new Error(`Bybit asset detail not found for ${symbol}`);
  }

  const intervalMap = createBybitIntervalMap(instruments);
  return normalizeBybitAssetDetail(ticker, getBybitIntervalHours(intervalMap, ticker.symbol));
}

export async function fetchBybitAssetHistory(
  symbol: string,
  startTimeMs: number,
  endTimeMs: number
): Promise<AssetFundingHistoryMarketData> {
  const [points, pricePoints] = await Promise.all([
    fetchBybitFundingHistory(symbol, startTimeMs, endTimeMs),
    fetchBybitMarkPriceHistory(symbol, startTimeMs, endTimeMs)
  ]);

  return {
    symbol,
    points,
    pricePoints
  };
}
