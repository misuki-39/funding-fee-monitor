import { formatCycle } from "../../src/shared/lib/formatters.js";
import type { AssetDetailMarketData, AssetFundingHistoryMarketData, AssetFundingHistoryPoint, FundingRow, PricePoint } from "../../src/shared/types/market.js";
import { dedupeByTime } from "../lib/timeSeries.js";
import { postUpstreamJson } from "../lib/upstream.js";

const infoUrl = "https://api.hyperliquid.xyz/info";

const fundingIntervalHours = 1;
const hourMs = 60 * 60 * 1000;

interface HyperliquidUniverseEntry {
  name: string;
  szDecimals: number;
  maxLeverage: number;
  isDelisted?: boolean;
  onlyIsolated?: boolean;
}

interface HyperliquidAssetCtx {
  funding: string;
  markPx: string;
  oraclePx: string;
  midPx: string;
  premium: string;
  openInterest: string;
  prevDayPx: string;
  dayNtlVlm: string;
  impactPxs?: string[];
  dayBaseVlm?: string;
}

type MetaAndAssetCtxs = [{ universe: HyperliquidUniverseEntry[] }, HyperliquidAssetCtx[]];

interface HyperliquidFundingHistoryDto {
  coin: string;
  fundingRate: string;
  premium: string;
  time: number;
}

interface HyperliquidCandleDto {
  t: number;
  T: number;
  s: string;
  i: string;
  o: string;
  c: string;
  h: string;
  l: string;
  v: string;
  n: number;
}

function nextHourBoundaryMs(nowMs: number): number {
  return Math.ceil(nowMs / hourMs) * hourMs;
}

export function normalizeHyperliquidRow(
  entry: HyperliquidUniverseEntry,
  ctx: HyperliquidAssetCtx,
  nowMs: number
): FundingRow {
  const fundingRate = Number(ctx.funding);

  if (!entry.name || Number.isNaN(fundingRate)) {
    throw new Error(`Invalid Hyperliquid funding rate row: ${JSON.stringify({ entry, ctx })}`);
  }

  return {
    symbol: entry.name,
    fundingRate,
    cycleLabel: formatCycle(fundingIntervalHours),
    settlementTimeMs: nextHourBoundaryMs(nowMs)
  };
}

export function normalizeHyperliquidAssetDetail(
  entry: HyperliquidUniverseEntry,
  ctx: HyperliquidAssetCtx
): AssetDetailMarketData {
  const fundingRate = Number(ctx.funding);
  const markPrice = Number(ctx.markPx);

  if (!entry.name || Number.isNaN(fundingRate) || Number.isNaN(markPrice)) {
    throw new Error(`Invalid Hyperliquid asset detail row: ${JSON.stringify({ entry, ctx })}`);
  }

  return {
    symbol: entry.name,
    fundingRate,
    markPrice,
    cycleLabel: formatCycle(fundingIntervalHours)
  };
}

export function normalizeHyperliquidFundingHistoryPoint(raw: HyperliquidFundingHistoryDto): AssetFundingHistoryPoint {
  const fundingRate = Number(raw.fundingRate);
  const fundingTimeMs = Number(raw.time);

  if (!raw.coin || Number.isNaN(fundingRate) || Number.isNaN(fundingTimeMs)) {
    throw new Error(`Invalid Hyperliquid funding history row: ${JSON.stringify(raw)}`);
  }

  return {
    fundingTimeMs,
    fundingRate
  };
}

export function normalizeHyperliquidCandle(raw: HyperliquidCandleDto): PricePoint {
  const timeMs = Number(raw.t);
  const price = Number(raw.o);

  if (Number.isNaN(timeMs) || Number.isNaN(price)) {
    throw new Error(`Invalid Hyperliquid candle: ${JSON.stringify(raw)}`);
  }

  return { timeMs, price };
}

async function fetchMetaAndAssetCtxs(): Promise<MetaAndAssetCtxs> {
  const payload = await postUpstreamJson<MetaAndAssetCtxs>(
    infoUrl,
    { type: "metaAndAssetCtxs" },
    "Hyperliquid metaAndAssetCtxs API"
  );

  if (!Array.isArray(payload) || payload.length !== 2 || !Array.isArray(payload[0]?.universe) || !Array.isArray(payload[1])) {
    throw new Error("Hyperliquid metaAndAssetCtxs API returned an invalid payload");
  }

  if (payload[0].universe.length !== payload[1].length) {
    throw new Error("Hyperliquid metaAndAssetCtxs universe and assetCtxs lengths differ");
  }

  return payload;
}

export async function fetchHyperliquidRows(): Promise<FundingRow[]> {
  const [meta, ctxs] = await fetchMetaAndAssetCtxs();
  const nowMs = Date.now();

  return meta.universe
    .map((entry, index) => ({ entry, ctx: ctxs[index] }))
    .filter(({ entry }) => !entry.isDelisted)
    .map(({ entry, ctx }) => normalizeHyperliquidRow(entry, ctx, nowMs));
}

export async function fetchHyperliquidAssetDetail(coin: string): Promise<AssetDetailMarketData> {
  const [meta, ctxs] = await fetchMetaAndAssetCtxs();

  const index = meta.universe.findIndex((entry) => entry.name === coin);
  if (index === -1) {
    throw new Error(`Hyperliquid universe does not contain coin: ${coin}`);
  }

  const entry = meta.universe[index];
  if (entry.isDelisted) {
    throw new Error(`Hyperliquid coin is delisted: ${coin}`);
  }

  return normalizeHyperliquidAssetDetail(entry, ctxs[index]);
}

async function fetchHyperliquidFundingHistoryPage(
  coin: string,
  startTimeMs: number,
  endTimeMs: number
): Promise<HyperliquidFundingHistoryDto[]> {
  const payload = await postUpstreamJson<HyperliquidFundingHistoryDto[]>(
    infoUrl,
    { type: "fundingHistory", coin, startTime: startTimeMs, endTime: endTimeMs },
    "Hyperliquid fundingHistory API"
  );

  if (!Array.isArray(payload)) {
    throw new Error("Hyperliquid fundingHistory API returned an invalid payload");
  }

  return payload;
}

async function fetchHyperliquidFundingHistory(
  coin: string,
  startTimeMs: number,
  endTimeMs: number
): Promise<HyperliquidFundingHistoryDto[]> {
  const all: HyperliquidFundingHistoryDto[] = [];
  let cursor = startTimeMs;

  // The endpoint caps at 500 rows per call; advance cursor past the last row each iteration.
  while (cursor <= endTimeMs) {
    const page = await fetchHyperliquidFundingHistoryPage(coin, cursor, endTimeMs);
    if (page.length === 0) {
      break;
    }
    all.push(...page);
    const lastTime = page[page.length - 1].time;
    if (lastTime <= cursor || page.length < 500) {
      break;
    }
    cursor = lastTime + 1;
  }

  return all;
}

export async function fetchHyperliquidAssetHistory(
  coin: string,
  startTimeMs: number,
  endTimeMs: number
): Promise<AssetFundingHistoryMarketData> {
  const [fundingRows, candleRows] = await Promise.all([
    fetchHyperliquidFundingHistory(coin, startTimeMs, endTimeMs),
    postUpstreamJson<HyperliquidCandleDto[]>(
      infoUrl,
      {
        type: "candleSnapshot",
        req: { coin, interval: "1h", startTime: startTimeMs, endTime: endTimeMs }
      },
      "Hyperliquid candleSnapshot API"
    )
  ]);

  if (!Array.isArray(candleRows)) {
    throw new Error("Hyperliquid candleSnapshot API returned an invalid payload");
  }

  const points = dedupeByTime(
    fundingRows.map(normalizeHyperliquidFundingHistoryPoint),
    (point) => point.fundingTimeMs,
    startTimeMs,
    endTimeMs
  );

  const pricePoints = dedupeByTime(
    candleRows.map(normalizeHyperliquidCandle),
    (point) => point.timeMs,
    startTimeMs,
    endTimeMs
  );

  return {
    symbol: coin,
    points,
    pricePoints
  };
}
