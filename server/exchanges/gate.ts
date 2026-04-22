import { formatCycle } from "../../src/shared/lib/formatters.js";
import type { AssetDetailMarketData, AssetFundingHistoryMarketData, AssetFundingHistoryPoint, FundingRow, PricePoint } from "../../src/shared/types/market.js";
import { fetchUpstreamJson } from "../lib/upstream.js";

const gateContractsUrl = "https://api.gateio.ws/api/v4/futures/usdt/contracts";
const gateFundingRateHistoryUrl = "https://api.gateio.ws/api/v4/futures/usdt/funding_rate";
const gateCandlesticksUrl = "https://api.gateio.ws/api/v4/futures/usdt/candlesticks";

interface GateContractDto {
  name: string;
  funding_rate: string | number;
  funding_interval: string | number;
  funding_next_apply: string | number;
  mark_price?: string | number;
}

interface GateFundingRateHistoryDto {
  t: number;
  r: string;
}

interface GateCandleDto {
  t: number;
  o: string;
}

export function normalizeGateRow(raw: GateContractDto): FundingRow {
  const fundingRate = Number(raw.funding_rate);
  const intervalSeconds = Number(raw.funding_interval);
  const nextApplySeconds = Number(raw.funding_next_apply);

  if (!raw.name || Number.isNaN(fundingRate) || Number.isNaN(intervalSeconds) || Number.isNaN(nextApplySeconds)) {
    throw new Error(`Invalid Gate.io funding rate row: ${JSON.stringify(raw)}`);
  }

  const cycleHours = intervalSeconds / 3600;

  if (!Number.isInteger(intervalSeconds) || !Number.isInteger(cycleHours)) {
    throw new Error(`Invalid Gate.io funding interval for ${raw.name}: ${intervalSeconds}`);
  }

  return {
    symbol: raw.name,
    fundingRate,
    cycleLabel: formatCycle(cycleHours),
    settlementTimeMs: nextApplySeconds * 1000
  };
}

export function normalizeGateAssetDetail(raw: GateContractDto): AssetDetailMarketData {
  const fundingRate = Number(raw.funding_rate);
  const markPrice = Number(raw.mark_price);
  const intervalSeconds = Number(raw.funding_interval);

  if (!raw.name || Number.isNaN(fundingRate) || Number.isNaN(markPrice) || Number.isNaN(intervalSeconds)) {
    throw new Error(`Invalid Gate.io asset detail row: ${JSON.stringify(raw)}`);
  }

  const cycleHours = intervalSeconds / 3600;

  if (!Number.isInteger(intervalSeconds) || !Number.isInteger(cycleHours)) {
    throw new Error(`Invalid Gate.io funding interval for ${raw.name}: ${intervalSeconds}`);
  }

  return {
    symbol: raw.name,
    fundingRate,
    markPrice,
    cycleLabel: formatCycle(cycleHours)
  };
}

export function normalizeGateFundingHistoryPoint(raw: GateFundingRateHistoryDto): AssetFundingHistoryPoint {
  const fundingTimeMs = Number(raw.t) * 1000;
  const fundingRate = Number(raw.r);

  if (Number.isNaN(fundingTimeMs) || Number.isNaN(fundingRate)) {
    throw new Error(`Invalid Gate.io funding history row: ${JSON.stringify(raw)}`);
  }

  return {
    fundingTimeMs,
    fundingRate
  };
}

function normalizeGatePriceCandle(raw: GateCandleDto): PricePoint {
  const timeMs = Number(raw.t) * 1000;
  const price = Number(raw.o);

  if (Number.isNaN(timeMs) || Number.isNaN(price)) {
    throw new Error(`Invalid Gate.io candle row: ${JSON.stringify(raw)}`);
  }

  return { timeMs, price };
}

export async function fetchGateRows(): Promise<FundingRow[]> {
  const rows = await fetchUpstreamJson<GateContractDto[]>(gateContractsUrl, "Gate.io futures contracts API");

  if (!Array.isArray(rows)) {
    throw new Error("Gate.io futures contracts API returned an invalid payload");
  }

  return rows.map(normalizeGateRow);
}

export async function fetchGateAssetDetail(symbol: string): Promise<AssetDetailMarketData> {
  const row = await fetchUpstreamJson<GateContractDto>(
    `${gateContractsUrl}/${encodeURIComponent(symbol)}`,
    "Gate.io futures contract detail API"
  );

  if (!row || Array.isArray(row)) {
    throw new Error("Gate.io futures contract detail API returned an invalid payload");
  }

  return normalizeGateAssetDetail(row);
}

export async function fetchGateAssetHistory(
  symbol: string,
  startTimeMs: number,
  endTimeMs: number
): Promise<AssetFundingHistoryMarketData> {
  const [fundingHistoryRows, markPriceCandlesRaw] = await Promise.all([
    fetchUpstreamJson<GateFundingRateHistoryDto[]>(
      `${gateFundingRateHistoryUrl}?contract=${encodeURIComponent(symbol)}&limit=1000`,
      "Gate.io funding rate history API"
    ),
    fetchUpstreamJson<GateCandleDto[]>(
      `${gateCandlesticksUrl}?contract=${encodeURIComponent(`mark_${symbol}`)}&from=${Math.floor(startTimeMs / 1000)}&to=${Math.floor(endTimeMs / 1000)}&interval=15m`,
      "Gate.io mark price candles API"
    )
  ]);

  if (!Array.isArray(fundingHistoryRows)) {
    throw new Error("Gate.io funding rate history API returned an invalid payload");
  }

  if (!Array.isArray(markPriceCandlesRaw)) {
    throw new Error("Gate.io mark price candles API returned an invalid payload");
  }

  const points = fundingHistoryRows
    .map(normalizeGateFundingHistoryPoint)
    .filter((point) => point.fundingTimeMs >= startTimeMs && point.fundingTimeMs <= endTimeMs)
    .sort((left, right) => left.fundingTimeMs - right.fundingTimeMs);

  const pricePoints = markPriceCandlesRaw
    .map(normalizeGatePriceCandle)
    .filter((point) => point.timeMs >= startTimeMs && point.timeMs <= endTimeMs)
    .sort((left, right) => left.timeMs - right.timeMs);

  return {
    symbol,
    points,
    pricePoints
  };
}
