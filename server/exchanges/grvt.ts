import { formatCycle } from "../../src/shared/lib/formatters.js";
import type {
  AssetDetailMarketData,
  AssetFundingHistoryMarketData,
  AssetFundingHistoryPoint,
  FundingRow,
  PricePoint
} from "../../src/shared/types/market.js";
import { getOrFetch, peekCache } from "../lib/cache.js";
import { postUpstreamJson } from "../lib/upstream.js";

const marketDataBase = "https://market-data.grvt.io";
const metadataTtlMs = 4 * 60 * 60 * 1000;
const allInstrumentsUrl = `${marketDataBase}/full/v1/all_instruments`;
const instrumentUrl = `${marketDataBase}/full/v1/instrument`;
const tickerUrl = `${marketDataBase}/full/v1/ticker`;
const fundingUrl = `${marketDataBase}/full/v1/funding`;
const klineUrl = `${marketDataBase}/full/v1/kline`;
const fundingHistoryLimit = 1000;
const candleLimit = 1000;
const tickerConcurrency = 10;
const allInstrumentsCacheKey = "grvt:all_instruments:usdt-perp";

interface GrvtListResponse<T> {
  result: T[];
  next?: string | null;
}

interface GrvtSingleResponse<T> {
  result: T;
}

interface GrvtInstrumentDto {
  instrument: string;
  base: string;
  quote: string;
  kind: string;
  funding_interval_hours: number;
}

interface GrvtTickerDto {
  instrument: string;
  mark_price: string;
  funding_rate: string;
  next_funding_time: string;
}

interface GrvtFundingHistoryDto {
  instrument: string;
  funding_rate: string;
  funding_time: string;
  funding_interval_hours: number;
}

interface GrvtCandleDto {
  open_time: string;
  open: string;
}

function nsToMs(value: string): number {
  const ns = Number(value);
  if (!Number.isFinite(ns)) {
    throw new Error(`Invalid GRVT nanosecond timestamp: ${value}`);
  }
  return Math.round(ns / 1_000_000);
}

function msToNs(value: number): string {
  return `${BigInt(Math.round(value)) * 1_000_000n}`;
}

function parseGrvtPercentageRate(value: string): number {
  const rate = Number(value);
  if (!Number.isFinite(rate)) {
    throw new Error(`Invalid GRVT funding rate: ${value}`);
  }
  return rate / 100;
}

export function createGrvtIntervalMap(rows: GrvtInstrumentDto[]): Map<string, number> {
  const intervalMap = new Map<string, number>();

  for (const item of rows) {
    if (!item.instrument || typeof item.funding_interval_hours !== "number" || item.funding_interval_hours <= 0) {
      continue;
    }

    intervalMap.set(item.instrument, item.funding_interval_hours);
  }

  return intervalMap;
}

function getGrvtIntervalHours(intervalMap: Map<string, number>, instrument: string): number {
  const intervalHours = intervalMap.get(instrument);

  if (intervalHours == null) {
    throw new Error(`Missing GRVT funding interval for ${instrument}`);
  }

  return intervalHours;
}

export function normalizeGrvtRow(raw: GrvtTickerDto, intervalHours: number): FundingRow {
  if (!raw.instrument) {
    throw new Error(`Invalid GRVT ticker row: ${JSON.stringify(raw)}`);
  }

  return {
    symbol: raw.instrument,
    fundingRate: parseGrvtPercentageRate(raw.funding_rate),
    cycleLabel: formatCycle(intervalHours),
    settlementTimeMs: nsToMs(raw.next_funding_time)
  };
}

export function normalizeGrvtAssetDetail(raw: GrvtTickerDto, intervalHours: number): AssetDetailMarketData {
  const markPrice = Number(raw.mark_price);

  if (!raw.instrument || !Number.isFinite(markPrice)) {
    throw new Error(`Invalid GRVT asset detail row: ${JSON.stringify(raw)}`);
  }

  return {
    symbol: raw.instrument,
    fundingRate: parseGrvtPercentageRate(raw.funding_rate),
    markPrice,
    cycleLabel: formatCycle(intervalHours)
  };
}

export function normalizeGrvtFundingHistoryPoint(raw: GrvtFundingHistoryDto): AssetFundingHistoryPoint {
  if (!raw.instrument) {
    throw new Error(`Invalid GRVT funding history row: ${JSON.stringify(raw)}`);
  }

  return {
    fundingTimeMs: nsToMs(raw.funding_time),
    fundingRate: parseGrvtPercentageRate(raw.funding_rate)
  };
}

export function normalizeGrvtCandle(raw: GrvtCandleDto): PricePoint {
  const price = Number(raw.open);

  if (!Number.isFinite(price)) {
    throw new Error(`Invalid GRVT candle: ${JSON.stringify(raw)}`);
  }

  return { timeMs: nsToMs(raw.open_time), price };
}

async function mapWithConcurrency<TIn, TOut>(
  items: TIn[],
  concurrency: number,
  worker: (item: TIn) => Promise<TOut>
): Promise<TOut[]> {
  const results: TOut[] = Array.from({ length: items.length }, () => undefined as unknown as TOut);
  let cursor = 0;

  async function runOne() {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      results[index] = await worker(items[index]);
    }
  }

  const runners = Array.from({ length: Math.min(concurrency, items.length) }, () => runOne());
  await Promise.all(runners);
  return results;
}

async function fetchGrvtAllPerps(): Promise<GrvtInstrumentDto[]> {
  return getOrFetch(allInstrumentsCacheKey, metadataTtlMs, async () => {
    const envelope = await postUpstreamJson<GrvtListResponse<GrvtInstrumentDto>>(
      allInstrumentsUrl,
      { is_active: true, kind: ["PERPETUAL"], quote: ["USDT"] },
      "GRVT all_instruments API"
    );

    if (!Array.isArray(envelope.result)) {
      throw new Error("GRVT all_instruments API returned an invalid payload");
    }

    return envelope.result;
  });
}

async function fetchGrvtTicker(instrument: string): Promise<GrvtTickerDto> {
  const envelope = await postUpstreamJson<GrvtSingleResponse<GrvtTickerDto>>(
    tickerUrl,
    { instrument },
    "GRVT ticker API"
  );

  if (!envelope.result || typeof envelope.result !== "object") {
    throw new Error(`GRVT ticker API returned an invalid payload for ${instrument}`);
  }

  return envelope.result;
}

async function fetchGrvtSingleInstrument(instrument: string): Promise<GrvtInstrumentDto> {
  return getOrFetch(`grvt:instrument:${instrument}`, metadataTtlMs, async () => {
    const envelope = await postUpstreamJson<GrvtSingleResponse<GrvtInstrumentDto>>(
      instrumentUrl,
      { instrument },
      "GRVT instrument API"
    );

    if (!envelope.result || typeof envelope.result !== "object") {
      throw new Error(`GRVT instrument API returned an invalid payload for ${instrument}`);
    }

    return envelope.result;
  });
}

async function fetchGrvtFundingHistory(
  instrument: string,
  startTimeMs: number,
  endTimeMs: number
): Promise<AssetFundingHistoryPoint[]> {
  const points: AssetFundingHistoryPoint[] = [];
  let cursor: string | null = null;

  while (true) {
    const body: Record<string, unknown> = cursor
      ? { instrument, cursor }
      : {
          instrument,
          start_time: msToNs(startTimeMs),
          end_time: msToNs(endTimeMs),
          limit: fundingHistoryLimit
        };

    const envelope = await postUpstreamJson<GrvtListResponse<GrvtFundingHistoryDto>>(
      fundingUrl,
      body,
      "GRVT funding history API"
    );

    if (!Array.isArray(envelope.result) || envelope.result.length === 0) {
      break;
    }

    const batch = envelope.result.map(normalizeGrvtFundingHistoryPoint);
    points.push(...batch);

    const oldestTime = Math.min(...batch.map((point) => point.fundingTimeMs));
    if (oldestTime <= startTimeMs || !envelope.next) {
      break;
    }

    cursor = envelope.next;
  }

  return [...new Map(
    points
      .filter((point) => point.fundingTimeMs >= startTimeMs && point.fundingTimeMs <= endTimeMs)
      .map((point) => [point.fundingTimeMs, point] as const)
  ).values()].sort((left, right) => left.fundingTimeMs - right.fundingTimeMs);
}

async function fetchGrvtMarkPriceHistory(
  instrument: string,
  startTimeMs: number,
  endTimeMs: number
): Promise<PricePoint[]> {
  const candles: PricePoint[] = [];
  let cursor: string | null = null;

  while (true) {
    const body: Record<string, unknown> = cursor
      ? { instrument, interval: "CI_15_M", type: "MARK", cursor }
      : {
          instrument,
          interval: "CI_15_M",
          type: "MARK",
          start_time: msToNs(startTimeMs),
          end_time: msToNs(endTimeMs),
          limit: candleLimit
        };

    const envelope = await postUpstreamJson<GrvtListResponse<GrvtCandleDto>>(
      klineUrl,
      body,
      "GRVT kline API"
    );

    if (!Array.isArray(envelope.result) || envelope.result.length === 0) {
      break;
    }

    const batch = envelope.result.map(normalizeGrvtCandle);
    candles.push(...batch);

    const oldestTime = Math.min(...batch.map((point) => point.timeMs));
    if (oldestTime <= startTimeMs || !envelope.next) {
      break;
    }

    cursor = envelope.next;
  }

  return [...new Map(
    candles
      .filter((point) => point.timeMs >= startTimeMs && point.timeMs <= endTimeMs)
      .map((point) => [point.timeMs, point] as const)
  ).values()].sort((left, right) => left.timeMs - right.timeMs);
}

export async function fetchGrvtRows(): Promise<FundingRow[]> {
  const instruments = await fetchGrvtAllPerps();
  const intervalMap = createGrvtIntervalMap(instruments);
  const eligible = instruments.filter((item) => intervalMap.has(item.instrument));

  const tickers = await mapWithConcurrency(eligible, tickerConcurrency, async (item) => {
    try {
      return await fetchGrvtTicker(item.instrument);
    } catch {
      return null;
    }
  });

  return tickers
    .filter((ticker): ticker is GrvtTickerDto => ticker !== null && ticker.funding_rate !== "" && ticker.next_funding_time !== "")
    .map((ticker) => normalizeGrvtRow(ticker, getGrvtIntervalHours(intervalMap, ticker.instrument)));
}

export async function fetchGrvtAssetDetail(instrument: string): Promise<AssetDetailMarketData> {
  const cachedBulk = peekCache<GrvtInstrumentDto[]>(allInstrumentsCacheKey);
  const cachedHit = cachedBulk?.find((item) => item.instrument === instrument);

  const [ticker, intervalHours] = await Promise.all([
    fetchGrvtTicker(instrument),
    cachedHit && cachedHit.funding_interval_hours > 0
      ? Promise.resolve(cachedHit.funding_interval_hours)
      : fetchGrvtSingleInstrument(instrument).then((dto) => dto.funding_interval_hours)
  ]);

  if (!intervalHours || intervalHours <= 0) {
    throw new Error(`Missing GRVT funding interval for ${instrument}`);
  }

  return normalizeGrvtAssetDetail(ticker, intervalHours);
}

export async function fetchGrvtAssetHistory(
  instrument: string,
  startTimeMs: number,
  endTimeMs: number
): Promise<AssetFundingHistoryMarketData> {
  const [points, pricePoints] = await Promise.all([
    fetchGrvtFundingHistory(instrument, startTimeMs, endTimeMs),
    fetchGrvtMarkPriceHistory(instrument, startTimeMs, endTimeMs)
  ]);

  return {
    symbol: instrument,
    points,
    pricePoints
  };
}
