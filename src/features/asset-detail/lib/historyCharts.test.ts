import { describe, expect, test } from "vitest";
import type { AssetFundingHistoryRow } from "../../../shared/types/market.js";
import {
  buildFundingHistoryChartData,
  buildPairwiseComparisonChartData
} from "./historyCharts.js";

const HOUR = 3_600_000;
const Q = 15 * 60_000; // 15 min

const rows: AssetFundingHistoryRow[] = [
  {
    market: "okx",
    base: "WAL",
    symbol: "WAL-USDT-SWAP",
    points: [
      { fundingTimeMs: 0 * HOUR, fundingRate: 0.001 },
      { fundingTimeMs: 8 * HOUR, fundingRate: 0.002 }
    ],
    pricePoints: [
      { timeMs: 0 * Q, price: 10 },
      { timeMs: 1 * Q, price: 10.1 },
      { timeMs: 32 * Q, price: 11 }
    ],
    available: true,
    errorMessage: null
  },
  {
    market: "binance",
    base: "WAL",
    symbol: "WALUSDT",
    points: [
      { fundingTimeMs: 4 * HOUR, fundingRate: 0.01 },
      { fundingTimeMs: 8 * HOUR, fundingRate: -0.02 }
    ],
    pricePoints: [
      { timeMs: 0 * Q, price: 12 },
      { timeMs: 16 * Q, price: 12.5 },
      { timeMs: 32 * Q, price: 13 }
    ],
    available: true,
    errorMessage: null
  },
  {
    market: "gate",
    base: "WAL",
    symbol: "WAL_USDT",
    points: [],
    pricePoints: [],
    available: false,
    errorMessage: "missing"
  }
];

describe("history chart helpers", () => {
  test("builds chart with funding on hour grid and price on 15min grid", () => {
    const result = buildFundingHistoryChartData(rows, ["okx", "binance"]);

    // Should contain both funding (hour-snapped) and price (15min-snapped) entries
    const fundingTimes = result.filter((r) => r["funding:okx"] != null || r["funding:binance"] != null).map((r) => r.timeMs);
    const priceTimes = result.filter((r) => r["price:okx"] != null || r["price:binance"] != null).map((r) => r.timeMs);

    // Funding points at 0h, 4h, 8h with forward-fill
    expect(fundingTimes).toContain(0);
    expect(fundingTimes).toContain(4 * HOUR);
    expect(fundingTimes).toContain(8 * HOUR);

    // Price points at 15min intervals
    expect(priceTimes).toContain(0);
    expect(priceTimes).toContain(1 * Q);
    expect(priceTimes).toContain(16 * Q);
    expect(priceTimes).toContain(32 * Q);

    // Forward-fill: at 4h okx funding should be carried from 0h
    const at4h = result.find((r) => r.timeMs === 4 * HOUR);
    expect(at4h?.["funding:okx"]).toBe(0.001);
    expect(at4h?.["funding:binance"]).toBe(0.01);
  });

  test("snaps nearby funding timestamps to the same hour", () => {
    const offset = 3_000;
    const nearbyRows: AssetFundingHistoryRow[] = [
      { market: "okx", base: "X", symbol: "X", points: [{ fundingTimeMs: 8 * HOUR, fundingRate: 0.001 }], pricePoints: [], available: true, errorMessage: null },
      { market: "binance", base: "X", symbol: "X", points: [{ fundingTimeMs: 8 * HOUR + offset, fundingRate: 0.002 }], pricePoints: [], available: true, errorMessage: null }
    ];
    const result = buildFundingHistoryChartData(nearbyRows, ["okx", "binance"]);
    expect(result).toEqual([
      { timeMs: 8 * HOUR, "funding:okx": 0.001, "funding:binance": 0.002 }
    ]);
  });

  test("builds pairwise cumulative comparison with price spread", () => {
    const result = buildPairwiseComparisonChartData(rows, ["okx", "binance"]);

    expect(result.lines).toEqual([
      { key: "pair:okx:binance", left: "okx", right: "binance" }
    ]);

    const at = (t: number) => result.data.find((r) => r.timeMs === t);

    // At 0h: both have price data (okx=10, binance=12)
    expect(at(0)?.["pair:okx:binance"]).toBe(0.001);
    expect(at(0)?.["spread:okx:binance"]).toBeCloseTo(10 / 12 - 1);

    // At 1Q (15min): price spread updates with okx=10.1, binance still 12
    expect(at(Q)?.["spread:okx:binance"]).toBeCloseTo(10.1 / 12 - 1);
    // Cumulative funding unchanged between funding events
    expect(at(Q)?.["pair:okx:binance"]).toBe(0.001);

    // At 4h: okx price still 10.1, binance price 12.5 (at 16Q = 4h)
    expect(at(4 * HOUR)?.["pair:okx:binance"]).toBeCloseTo(-0.009);
    expect(at(4 * HOUR)?.["spread:okx:binance"]).toBeCloseTo(10.1 / 12.5 - 1);

    // At 8h: okx price 11 (at 32Q = 8h), binance price 13 (at 32Q = 8h)
    expect(at(8 * HOUR)?.["pair:okx:binance"]).toBeCloseTo(0.013);
    expect(at(8 * HOUR)?.["spread:okx:binance"]).toBeCloseTo(11 / 13 - 1);
  });
});
