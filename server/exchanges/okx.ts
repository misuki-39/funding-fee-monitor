import { MARKETS } from "../../src/shared/config/markets.js";
import { formatCycle } from "../../src/shared/lib/formatters.js";
import type { AssetDetailMarketData, AssetFundingHistoryMarketData, AssetFundingHistoryPoint, FundingRow, PricePoint } from "../../src/shared/types/market.js";
import { fetchUpstreamJson } from "../lib/upstream.js";

const okxFundingRateUrl = "https://www.okx.com/api/v5/public/funding-rate";
const okxFundingRateHistoryUrl = "https://www.okx.com/api/v5/public/funding-rate-history";
const okxMarkPriceUrl = "https://www.okx.com/api/v5/public/mark-price";
const okxHistoryMarkPriceCandlesUrl = "https://www.okx.com/api/v5/market/history-mark-price-candles";
const okxHistoryMarkPriceLimit = 100;

interface OkxFundingRateDto {
  instId: string;
  fundingRate: string;
  fundingTime: string;
  nextFundingTime: string;
}

interface OkxFundingEnvelope {
  code: string;
  msg: string;
  data: OkxFundingRateDto[];
}

interface OkxFundingRateHistoryDto {
  instId: string;
  fundingTime: string;
  realizedRate: string;
}

interface OkxFundingRateHistoryEnvelope {
  code: string;
  msg: string;
  data: OkxFundingRateHistoryDto[];
}

interface OkxMarkPriceDto {
  instId: string;
  markPx: string;
}

interface OkxMarkPriceEnvelope {
  code: string;
  msg: string;
  data: OkxMarkPriceDto[];
}

type OkxMarkPriceCandleDto = [string, string, string, string, string, string, string, string, string];

interface OkxMarkPriceCandlesEnvelope {
  code: string;
  msg: string;
  data: OkxMarkPriceCandleDto[];
}

interface OkxMarkPriceCandle {
  openTimeMs: number;
  openPrice: number;
}

export function normalizeOkxRow(raw: OkxFundingRateDto): FundingRow {
  const fundingRate = Number(raw.fundingRate);
  const fundingTimeMs = Number(raw.fundingTime);
  const nextFundingTimeMs = Number(raw.nextFundingTime);

  if (!raw.instId || Number.isNaN(fundingRate) || Number.isNaN(fundingTimeMs) || Number.isNaN(nextFundingTimeMs)) {
    throw new Error(`Invalid OKX funding rate row: ${JSON.stringify(raw)}`);
  }

  const cycleHours = (nextFundingTimeMs - fundingTimeMs) / 3600000;

  return {
    symbol: raw.instId,
    fundingRate,
    cycleLabel: formatCycle(cycleHours),
    settlementTimeMs: fundingTimeMs
  };
}

export function normalizeOkxAssetDetail(
  fundingRateRaw: OkxFundingRateDto,
  markPriceRaw: OkxMarkPriceDto
): AssetDetailMarketData {
  const fundingRate = Number(fundingRateRaw.fundingRate);
  const markPrice = Number(markPriceRaw.markPx);
  const fundingTimeMs = Number(fundingRateRaw.fundingTime);
  const nextFundingTimeMs = Number(fundingRateRaw.nextFundingTime);

  if (
    !fundingRateRaw.instId ||
    fundingRateRaw.instId !== markPriceRaw.instId ||
    Number.isNaN(fundingRate) ||
    Number.isNaN(markPrice) ||
    Number.isNaN(fundingTimeMs) ||
    Number.isNaN(nextFundingTimeMs)
  ) {
    throw new Error(`Invalid OKX asset detail payload: funding=${JSON.stringify(fundingRateRaw)} mark=${JSON.stringify(markPriceRaw)}`);
  }

  const cycleHours = (nextFundingTimeMs - fundingTimeMs) / 3600000;

  return {
    symbol: fundingRateRaw.instId,
    fundingRate,
    markPrice,
    cycleLabel: formatCycle(cycleHours)
  };
}

export function normalizeOkxFundingHistoryPoint(raw: OkxFundingRateHistoryDto): AssetFundingHistoryPoint {
  const fundingRate = Number(raw.realizedRate);
  const fundingTimeMs = Number(raw.fundingTime);

  if (!raw.instId || Number.isNaN(fundingRate) || Number.isNaN(fundingTimeMs)) {
    throw new Error(`Invalid OKX funding history row: ${JSON.stringify(raw)}`);
  }

  return {
    fundingTimeMs,
    fundingRate
  };
}

function normalizeOkxMarkPriceCandle(raw: OkxMarkPriceCandleDto): OkxMarkPriceCandle {
  const openTimeMs = Number(raw[0]);
  const openPrice = Number(raw[1]);

  if (Number.isNaN(openTimeMs) || Number.isNaN(openPrice)) {
    throw new Error(`Invalid OKX mark price candle: ${JSON.stringify(raw)}`);
  }

  return {
    openTimeMs,
    openPrice
  };
}

async function fetchOkxMarkPriceHistory(
  instId: string,
  startTimeMs: number,
  endTimeMs: number
): Promise<OkxMarkPriceCandle[]> {
  const candles: OkxMarkPriceCandle[] = [];
  let after: string | null = null;

  while (true) {
    const searchParams = new URLSearchParams({
      instId,
      bar: "15m",
      limit: String(okxHistoryMarkPriceLimit)
    });

    if (after) {
      searchParams.set("after", after);
    }

    const envelope = await fetchUpstreamJson<OkxMarkPriceCandlesEnvelope>(
      `${okxHistoryMarkPriceCandlesUrl}?${searchParams.toString()}`,
      "OKX history mark-price candles API"
    );

    if (envelope.code !== "0") {
      throw new Error(`OKX history mark-price candles API failed: code=${envelope.code}, msg=${envelope.msg}`);
    }

    if (!Array.isArray(envelope.data) || envelope.data.length === 0) {
      break;
    }

    const batch = envelope.data.map(normalizeOkxMarkPriceCandle);
    candles.push(...batch);

    const oldestCandle = batch.at(-1);

    if (!oldestCandle || oldestCandle.openTimeMs <= startTimeMs || batch.length < okxHistoryMarkPriceLimit) {
      break;
    }

    after = String(oldestCandle.openTimeMs);
  }

  return [...new Map(
    candles
      .filter((candle) => candle.openTimeMs <= endTimeMs)
      .map((candle) => [candle.openTimeMs, candle] as const)
  ).values()].sort((left, right) => left.openTimeMs - right.openTimeMs);
}

export async function fetchOkxRows(): Promise<FundingRow[]> {
  const envelope = await fetchUpstreamJson<OkxFundingEnvelope>(MARKETS.okx.sourceUrl, "OKX funding-rate API");

  if (envelope.code !== "0") {
    throw new Error(`OKX funding-rate API failed: code=${envelope.code}, msg=${envelope.msg}`);
  }

  if (!Array.isArray(envelope.data)) {
    throw new Error("OKX funding-rate API returned an invalid data payload");
  }

  return envelope.data.map(normalizeOkxRow);
}

export async function fetchOkxAssetDetail(instId: string): Promise<AssetDetailMarketData> {
  const [fundingEnvelope, markPriceEnvelope] = await Promise.all([
    fetchUpstreamJson<OkxFundingEnvelope>(
      `${okxFundingRateUrl}?instId=${encodeURIComponent(instId)}`,
      "OKX funding-rate detail API"
    ),
    fetchUpstreamJson<OkxMarkPriceEnvelope>(
      `${okxMarkPriceUrl}?instType=SWAP&instId=${encodeURIComponent(instId)}`,
      "OKX mark-price API"
    )
  ]);

  if (fundingEnvelope.code !== "0") {
    throw new Error(`OKX funding-rate detail API failed: code=${fundingEnvelope.code}, msg=${fundingEnvelope.msg}`);
  }

  if (markPriceEnvelope.code !== "0") {
    throw new Error(`OKX mark-price API failed: code=${markPriceEnvelope.code}, msg=${markPriceEnvelope.msg}`);
  }

  const fundingRateRaw = fundingEnvelope.data[0];
  const markPriceRaw = markPriceEnvelope.data[0];

  if (!fundingRateRaw || !markPriceRaw) {
    throw new Error(`OKX asset detail not found for ${instId}`);
  }

  return normalizeOkxAssetDetail(fundingRateRaw, markPriceRaw);
}

export async function fetchOkxAssetHistory(
  instId: string,
  startTimeMs: number,
  endTimeMs: number
): Promise<AssetFundingHistoryMarketData> {
  const [fundingEnvelope, markPriceCandles] = await Promise.all([
    fetchUpstreamJson<OkxFundingRateHistoryEnvelope>(
      `${okxFundingRateHistoryUrl}?instId=${encodeURIComponent(instId)}&limit=400`,
      "OKX funding-rate history API"
    ),
    fetchOkxMarkPriceHistory(instId, startTimeMs, endTimeMs)
  ]);

  if (fundingEnvelope.code !== "0") {
    throw new Error(`OKX funding-rate history API failed: code=${fundingEnvelope.code}, msg=${fundingEnvelope.msg}`);
  }

  if (!Array.isArray(fundingEnvelope.data)) {
    throw new Error("OKX funding-rate history API returned an invalid payload");
  }

  const points = fundingEnvelope.data
    .map(normalizeOkxFundingHistoryPoint)
    .filter((point) => point.fundingTimeMs >= startTimeMs && point.fundingTimeMs <= endTimeMs)
    .sort((left, right) => left.fundingTimeMs - right.fundingTimeMs);

  const pricePoints: PricePoint[] = markPriceCandles
    .filter((candle) => candle.openTimeMs >= startTimeMs && candle.openTimeMs <= endTimeMs)
    .map((candle) => ({ timeMs: candle.openTimeMs, price: candle.openPrice }));

  return {
    symbol: instId,
    points,
    pricePoints
  };
}
