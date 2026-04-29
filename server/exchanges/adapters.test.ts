import { describe, expect, test } from "vitest";
import { mergeBinanceRows, normalizeBinanceAssetDetail, normalizeBinanceHistoryPoint } from "./binance.js";
import { normalizeBitgetAssetDetail, normalizeBitgetCandle, normalizeBitgetFundingHistoryPoint, normalizeBitgetRow } from "./bitget.js";
import {
  createBybitIntervalMap,
  normalizeBybitAssetDetail,
  normalizeBybitCandle,
  normalizeBybitFundingHistoryPoint,
  normalizeBybitRow
} from "./bybit.js";
import { normalizeGateAssetDetail, normalizeGateFundingHistoryPoint } from "./gate.js";
import { normalizeOkxAssetDetail, normalizeOkxFundingHistoryPoint } from "./okx.js";

describe("exchange adapters", () => {
  test("normalizeBinanceAssetDetail reads funding rate and mark price", () => {
    expect(normalizeBinanceAssetDetail({
      symbol: "WALUSDT",
      lastFundingRate: "0.0001",
      nextFundingTime: 10_000,
      markPrice: "0.5234"
    }, 8)).toEqual({
      symbol: "WALUSDT",
      fundingRate: 0.0001,
      markPrice: 0.5234,
      cycleLabel: "8h"
    });
  });

  test("normalizeBinanceHistoryPoint reads funding history", () => {
    expect(normalizeBinanceHistoryPoint({
      symbol: "WALUSDT",
      fundingRate: "0.0001",
      fundingTime: 20_000,
      markPrice: "0.6234"
    })).toEqual({
      fundingTimeMs: 20_000,
      fundingRate: 0.0001
    });
  });

  test("mergeBinanceRows skips contracts with missing funding interval", () => {
    const result = mergeBinanceRows([
      {
        symbol: "WALUSDT",
        lastFundingRate: "0.0001",
        nextFundingTime: 10_000,
        markPrice: "0.5234"
      }
    ], []);
    expect(result).toEqual([]);
  });

  test("normalizeOkxAssetDetail merges funding rate and mark price payloads", () => {
    expect(normalizeOkxAssetDetail(
      {
        instId: "WAL-USDT-SWAP",
        fundingRate: "-0.0002",
        fundingTime: "1000",
        nextFundingTime: "28801000"
      },
      {
        instId: "WAL-USDT-SWAP",
        markPx: "0.6123"
      }
    )).toEqual({
      symbol: "WAL-USDT-SWAP",
      fundingRate: -0.0002,
      markPrice: 0.6123,
      cycleLabel: "8h"
    });
  });

  test("normalizeOkxFundingHistoryPoint reads realized funding history", () => {
    expect(normalizeOkxFundingHistoryPoint({
      instId: "WAL-USDT-SWAP",
      fundingTime: "1000",
      realizedRate: "-0.0002"
    })).toEqual({
      fundingTimeMs: 1000,
      fundingRate: -0.0002
    });
  });

  test("normalizeGateAssetDetail reads funding rate and mark price", () => {
    expect(normalizeGateAssetDetail({
      name: "龙虾_USDT",
      funding_rate: "0.0003",
      funding_interval: 28800,
      funding_next_apply: 1775059200,
      mark_price: "0.7001"
    })).toEqual({
      symbol: "龙虾_USDT",
      fundingRate: 0.0003,
      markPrice: 0.7001,
      cycleLabel: "8h"
    });
  });

  test("normalizeGateFundingHistoryPoint reads funding history rows", () => {
    expect(normalizeGateFundingHistoryPoint({
      t: 1775059200,
      r: "0.0003"
    })).toEqual({
      fundingTimeMs: 1775059200 * 1000,
      fundingRate: 0.0003
    });
  });

  test("normalizeBitgetRow reads current funding rate rows", () => {
    expect(normalizeBitgetRow({
      symbol: "WALUSDT",
      fundingRate: "0.0004",
      fundingRateInterval: "4",
      nextUpdate: "1775059200000"
    })).toEqual({
      symbol: "WALUSDT",
      fundingRate: 0.0004,
      cycleLabel: "4h",
      settlementTimeMs: 1775059200000
    });
  });

  test("normalizeBitgetAssetDetail merges funding rate and mark price", () => {
    expect(normalizeBitgetAssetDetail(
      {
        symbol: "WALUSDT",
        fundingRate: "0.0004",
        fundingRateInterval: "4",
        nextUpdate: "1775059200000"
      },
      {
        symbol: "WALUSDT",
        markPrice: "1.2345"
      }
    )).toEqual({
      symbol: "WALUSDT",
      fundingRate: 0.0004,
      markPrice: 1.2345,
      cycleLabel: "4h"
    });
  });

  test("normalizeBitgetFundingHistoryPoint reads funding history rows", () => {
    expect(normalizeBitgetFundingHistoryPoint({
      symbol: "WALUSDT",
      fundingRate: "-0.0005",
      fundingTime: "1775059200000"
    })).toEqual({
      fundingTimeMs: 1775059200000,
      fundingRate: -0.0005
    });
  });

  test("normalizeBitgetCandle reads mark candle rows", () => {
    expect(normalizeBitgetCandle([
      "1775059200000",
      "1.2345",
      "1.25",
      "1.21",
      "1.24",
      "10",
      "12.3"
    ])).toEqual({
      timeMs: 1775059200000,
      price: 1.2345
    });
  });

  test("createBybitIntervalMap converts funding interval minutes into hours", () => {
    const intervalMap = createBybitIntervalMap([
      { symbol: "WALUSDT", fundingInterval: 480 },
      { symbol: "FOOUSDT", fundingInterval: 240 },
      { symbol: "NOFUNDINGUSDT", fundingInterval: 0 },
      { symbol: null, fundingInterval: 480 }
    ]);

    expect(intervalMap.get("WALUSDT")).toBe(8);
    expect(intervalMap.get("FOOUSDT")).toBe(4);
    expect(intervalMap.has("NOFUNDINGUSDT")).toBe(false);
  });

  test("normalizeBybitRow reads ticker funding rate rows", () => {
    expect(normalizeBybitRow({
      symbol: "WALUSDT",
      fundingRate: "0.0007",
      nextFundingTime: "1775059200000",
      markPrice: "0.5234"
    }, 8)).toEqual({
      symbol: "WALUSDT",
      fundingRate: 0.0007,
      cycleLabel: "8h",
      settlementTimeMs: 1775059200000
    });
  });

  test("normalizeBybitAssetDetail reads ticker funding rate and mark price", () => {
    expect(normalizeBybitAssetDetail({
      symbol: "WALUSDT",
      fundingRate: "-0.0008",
      nextFundingTime: "1775059200000",
      markPrice: "1.2345"
    }, 4)).toEqual({
      symbol: "WALUSDT",
      fundingRate: -0.0008,
      markPrice: 1.2345,
      cycleLabel: "4h"
    });
  });

  test("normalizeBybitFundingHistoryPoint reads funding history rows", () => {
    expect(normalizeBybitFundingHistoryPoint({
      symbol: "WALUSDT",
      fundingRate: "0.0009",
      fundingRateTimestamp: "1775059200000"
    })).toEqual({
      fundingTimeMs: 1775059200000,
      fundingRate: 0.0009
    });
  });

  test("normalizeBybitCandle reads mark candle rows", () => {
    expect(normalizeBybitCandle([
      "1775059200000",
      "1.2345",
      "1.26",
      "1.22",
      "1.25"
    ])).toEqual({
      timeMs: 1775059200000,
      price: 1.2345
    });
  });
});
