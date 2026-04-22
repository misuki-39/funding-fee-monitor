import type { AssetFundingHistoryRow, MarketKey, PricePoint } from "../../../shared/types/market.js";

const HOUR_MS = 3_600_000;
const QUARTER_MS = 15 * 60_000;

function snapToHour(timeMs: number): number {
  return Math.round(timeMs / HOUR_MS) * HOUR_MS;
}

function snapToQuarter(timeMs: number): number {
  return Math.round(timeMs / QUARTER_MS) * QUARTER_MS;
}

export interface HistoryChartRecord {
  timeMs: number;
  [seriesKey: string]: number | null;
}

export interface PairwiseComparisonLine {
  key: string;
  left: MarketKey;
  right: MarketKey;
}

function getSelectedRows(rows: AssetFundingHistoryRow[], selectedMarkets: MarketKey[]) {
  return rows
    .filter((row) => row.available && selectedMarkets.includes(row.market))
    .sort((left, right) => selectedMarkets.indexOf(left.market) - selectedMarkets.indexOf(right.market));
}

export function getDefaultHistoryMarkets(rows: AssetFundingHistoryRow[]): MarketKey[] {
  return rows
    .filter((row) => row.available && (row.points.length > 0 || row.pricePoints.length > 0))
    .map((row) => row.market);
}

export function buildFundingHistoryChartData(
  rows: AssetFundingHistoryRow[],
  selectedMarkets: MarketKey[]
): HistoryChartRecord[] {
  const selectedRows = getSelectedRows(rows, selectedMarkets);
  const records = new Map<number, HistoryChartRecord>();

  function getOrCreate(timeMs: number) {
    let record = records.get(timeMs);
    if (!record) {
      record = { timeMs };
      records.set(timeMs, record);
    }
    return record;
  }

  // Collect all hour-snapped times across all markets for funding forward-fill
  const allFundingTimes = new Set<number>();
  for (const r of selectedRows) {
    for (const p of r.points) {
      allFundingTimes.add(snapToHour(p.fundingTimeMs));
    }
  }
  const sortedFundingTimes = [...allFundingTimes].sort((a, b) => a - b);

  // Insert funding points (snapped to hour) with forward-fill
  for (const row of selectedRows) {
    const lookup = new Map<number, number>();
    for (const point of row.points) {
      lookup.set(snapToHour(point.fundingTimeMs), point.fundingRate);
    }

    let lastRate: number | null = null;
    for (const timeMs of sortedFundingTimes) {
      const rate = lookup.get(timeMs);
      if (rate != null) lastRate = rate;
      if (lastRate != null) {
        const record = getOrCreate(timeMs);
        record[`funding:${row.market}`] = lastRate;
      }
    }
  }

  // Insert price points (snapped to 15min)
  for (const row of selectedRows) {
    for (const point of row.pricePoints) {
      const snapped = snapToQuarter(point.timeMs);
      const record = getOrCreate(snapped);
      record[`price:${row.market}`] = point.price;
    }
  }

  // Sort and forward-fill funding across all time points (including 15-min price points)
  const sorted = [...records.values()].sort((left, right) => left.timeMs - right.timeMs);
  const lastFunding = new Map<string, number>();

  for (const record of sorted) {
    for (const row of selectedRows) {
      const key = `funding:${row.market}`;
      const value = record[key];
      if (value != null) {
        lastFunding.set(key, value);
      } else if (lastFunding.has(key)) {
        record[key] = lastFunding.get(key)!;
      }
    }
  }

  return sorted;
}

export function buildPairwiseComparisonLines(markets: MarketKey[]): PairwiseComparisonLine[] {
  const lines: PairwiseComparisonLine[] = [];

  for (let leftIndex = 0; leftIndex < markets.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < markets.length; rightIndex += 1) {
      const left = markets[leftIndex];
      const right = markets[rightIndex];
      lines.push({
        key: `pair:${left}:${right}`,
        left,
        right
      });
    }
  }

  return lines;
}

function buildPriceAtTimeLookup(pricePoints: PricePoint[]): (timeMs: number) => number | null {
  const sorted = [...pricePoints].sort((a, b) => a.timeMs - b.timeMs);
  // Binary search for the latest price at or before the given time
  return (timeMs: number) => {
    let lo = 0;
    let hi = sorted.length - 1;
    let result: number | null = null;

    while (lo <= hi) {
      const mid = (lo + hi) >>> 1;
      if (sorted[mid].timeMs <= timeMs) {
        result = sorted[mid].price;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }

    return result;
  };
}

export function buildPairwiseComparisonChartData(
  rows: AssetFundingHistoryRow[],
  selectedMarkets: MarketKey[]
): { data: HistoryChartRecord[]; lines: PairwiseComparisonLine[] } {
  const selectedRows = getSelectedRows(rows, selectedMarkets);

  if (selectedRows.length < 2) {
    return { data: [], lines: [] };
  }

  const timeSet = new Set<number>();
  for (const row of selectedRows) {
    for (const point of row.points) {
      timeSet.add(snapToHour(point.fundingTimeMs));
    }
    for (const point of row.pricePoints) {
      timeSet.add(snapToQuarter(point.timeMs));
    }
  }
  const allTimes = [...timeSet].sort((left, right) => left - right);
  const cumulativeByMarket = new Map<MarketKey, number>();
  const pointIndexByMarket = new Map<MarketKey, number>();
  const priceLookupByMarket = new Map<MarketKey, (timeMs: number) => number | null>();

  for (const row of selectedRows) {
    cumulativeByMarket.set(row.market, 0);
    pointIndexByMarket.set(row.market, 0);
    priceLookupByMarket.set(row.market, buildPriceAtTimeLookup(row.pricePoints));
  }

  const lines = buildPairwiseComparisonLines(selectedRows.map((row) => row.market));
  const data: HistoryChartRecord[] = [];

  for (const timeMs of allTimes) {
    for (const row of selectedRows) {
      let pointIndex = pointIndexByMarket.get(row.market) ?? 0;
      let cumulativeValue = cumulativeByMarket.get(row.market) ?? 0;

      while (pointIndex < row.points.length && snapToHour(row.points[pointIndex]?.fundingTimeMs ?? 0) === timeMs) {
        cumulativeValue += row.points[pointIndex]?.fundingRate ?? 0;
        pointIndex += 1;
      }

      pointIndexByMarket.set(row.market, pointIndex);
      cumulativeByMarket.set(row.market, cumulativeValue);
    }

    const record: HistoryChartRecord = { timeMs };

    for (const line of lines) {
      record[line.key] = (cumulativeByMarket.get(line.left) ?? 0) - (cumulativeByMarket.get(line.right) ?? 0);

      const priceLeft = priceLookupByMarket.get(line.left)?.(timeMs) ?? null;
      const priceRight = priceLookupByMarket.get(line.right)?.(timeMs) ?? null;
      record[`spread:${line.left}:${line.right}`] = priceLeft != null && priceRight != null && priceRight !== 0
        ? priceLeft / priceRight - 1
        : null;
    }

    data.push(record);
  }

  return { data, lines };
}
