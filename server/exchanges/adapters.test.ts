import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { mergeAsterRows, normalizeAsterAssetDetail, normalizeAsterHistoryPoint } from "./aster.js";
import { mergeBinanceRows, normalizeBinanceAssetDetail, normalizeBinanceHistoryPoint } from "./binance.js";
import {
  normalizeHyperliquidAssetDetail,
  normalizeHyperliquidCandle,
  normalizeHyperliquidFundingHistoryPoint,
  normalizeHyperliquidRow
} from "./hyperliquid.js";
import { normalizeBitgetAssetDetail, normalizeBitgetCandle, normalizeBitgetFundingHistoryPoint, normalizeBitgetRow } from "./bitget.js";
import {
  createBybitIntervalMap,
  normalizeBybitAssetDetail,
  normalizeBybitCandle,
  normalizeBybitFundingHistoryPoint,
  normalizeBybitRow
} from "./bybit.js";
import {
  normalizeGrvtAssetDetail,
  normalizeGrvtCandle,
  normalizeGrvtFundingHistoryPoint,
  normalizeGrvtRow
} from "./grvt.js";
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

  test("normalizeGrvtRow converts percentage-point funding rate and ns timestamp", () => {
    const row = normalizeGrvtRow({
      instrument: "BTC_USDT_Perp",
      mark_price: "76091.785647992",
      funding_rate: "-0.0036",
      next_funding_time: "1777564800000000000"
    }, 8);

    expect(row.symbol).toBe("BTC_USDT_Perp");
    expect(row.cycleLabel).toBe("8h");
    expect(row.settlementTimeMs).toBe(1777564800000);
    expect(row.fundingRate).toBeCloseTo(-0.000036, 12);
  });

  test("normalizeGrvtAssetDetail merges ticker funding and mark price", () => {
    const detail = normalizeGrvtAssetDetail({
      instrument: "ASTER_USDT_Perp",
      mark_price: "0.656794397",
      funding_rate: "0.005",
      next_funding_time: "1777550400000000000"
    }, 4);

    expect(detail.symbol).toBe("ASTER_USDT_Perp");
    expect(detail.cycleLabel).toBe("4h");
    expect(detail.markPrice).toBe(0.656794397);
    expect(detail.fundingRate).toBeCloseTo(0.00005, 12);
  });

  test("normalizeGrvtFundingHistoryPoint reads ns timestamp and percentage-point rate", () => {
    const point = normalizeGrvtFundingHistoryPoint({
      instrument: "BTC_USDT_Perp",
      funding_rate: "-0.0102",
      funding_time: "1777536000000000000",
      funding_interval_hours: 8
    });

    expect(point.fundingTimeMs).toBe(1777536000000);
    expect(point.fundingRate).toBeCloseTo(-0.000102, 12);
  });

  test("normalizeGrvtCandle reads mark kline open price", () => {
    expect(normalizeGrvtCandle({
      open_time: "1777538700000000000",
      open: "76092.036615747"
    })).toEqual({
      timeMs: 1777538700000,
      price: 76092.036615747
    });
  });

  test("normalizeAsterAssetDetail reads funding rate and mark price", () => {
    expect(normalizeAsterAssetDetail({
      symbol: "BTCUSDT",
      lastFundingRate: "0.00038246",
      nextFundingTime: 1597392000000,
      markPrice: "11793.63104562"
    }, 4)).toEqual({
      symbol: "BTCUSDT",
      fundingRate: 0.00038246,
      markPrice: 11793.63104562,
      cycleLabel: "4h"
    });
  });

  test("normalizeAsterHistoryPoint reads funding history without markPrice", () => {
    expect(normalizeAsterHistoryPoint({
      symbol: "BTCUSDT",
      fundingRate: "-0.03750000",
      fundingTime: 1570608000000
    })).toEqual({
      fundingTimeMs: 1570608000000,
      fundingRate: -0.0375
    });
  });

  describe("hyperliquid", () => {
    beforeEach(() => {
      // 2026-05-02 03:14:55.000 UTC — used to verify settlementTimeMs rounds up to next top-of-hour.
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-05-02T03:14:55.000Z"));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    test("normalizeHyperliquidRow hardcodes 1h cycle and rounds settlement to next top-of-hour", () => {
      const nowMs = Date.now();
      expect(normalizeHyperliquidRow(
        { name: "BTC", szDecimals: 5, maxLeverage: 40 },
        {
          funding: "-0.0000015626",
          markPx: "78179.0",
          oraclePx: "78225.0",
          midPx: "78176.5",
          premium: "-0.0006136146",
          openInterest: "28566.16356",
          prevDayPx: "77035.0",
          dayNtlVlm: "0"
        },
        nowMs
      )).toEqual({
        symbol: "BTC",
        fundingRate: -0.0000015626,
        cycleLabel: "1h",
        settlementTimeMs: Date.UTC(2026, 4, 2, 4, 0, 0)
      });
    });

    test("normalizeHyperliquidRow passes builder-DEX prefixed names through unchanged", () => {
      const nowMs = Date.now();
      expect(normalizeHyperliquidRow(
        { name: "xyz:CL", szDecimals: 4, maxLeverage: 10 },
        {
          funding: "0.00000625",
          markPx: "27515.0",
          oraclePx: "27528.0",
          midPx: "27515.5",
          premium: "-0.0004540831",
          openInterest: "12723.9192",
          prevDayPx: "27419.0",
          dayNtlVlm: "180199428.78"
        },
        nowMs
      )).toEqual({
        symbol: "xyz:CL",
        fundingRate: 0.00000625,
        cycleLabel: "1h",
        settlementTimeMs: Date.UTC(2026, 4, 2, 4, 0, 0)
      });
    });

    test("normalizeHyperliquidAssetDetail reads funding rate and mark price", () => {
      expect(normalizeHyperliquidAssetDetail(
        { name: "kPEPE", szDecimals: 0, maxLeverage: 10 },
        {
          funding: "0.0000125",
          markPx: "0.001234",
          oraclePx: "0.001234",
          midPx: "0.001234",
          premium: "0",
          openInterest: "0",
          prevDayPx: "0.001230",
          dayNtlVlm: "0"
        }
      )).toEqual({
        symbol: "kPEPE",
        fundingRate: 0.0000125,
        markPrice: 0.001234,
        cycleLabel: "1h"
      });
    });

    test("normalizeHyperliquidFundingHistoryPoint drops premium and reads ms timestamp", () => {
      expect(normalizeHyperliquidFundingHistoryPoint({
        coin: "BTC",
        fundingRate: "0.0000125",
        premium: "-0.0002417314",
        time: 1714521600016
      })).toEqual({
        fundingTimeMs: 1714521600016,
        fundingRate: 0.0000125
      });
    });

    test("normalizeHyperliquidCandle uses open price as PricePoint price", () => {
      expect(normalizeHyperliquidCandle({
        t: 1776999600000,
        T: 1777003199999,
        s: "BTC",
        i: "1h",
        o: "78089.0",
        c: "77710.0",
        h: "78142.0",
        l: "77505.0",
        v: "864.78186",
        n: 19979
      })).toEqual({
        timeMs: 1776999600000,
        price: 78089
      });
    });
  });

  test("mergeAsterRows skips contracts with missing funding interval and USD1-quoted perps", () => {
    const result = mergeAsterRows([
      {
        symbol: "BTCUSDT",
        lastFundingRate: "0.0001",
        nextFundingTime: 10_000,
        markPrice: "11793.63104562"
      },
      {
        symbol: "ETHUSD1",
        lastFundingRate: "0.0002",
        nextFundingTime: 30_000,
        markPrice: "3500"
      },
      {
        symbol: "ZORAUSDT",
        lastFundingRate: "0.00005",
        nextFundingTime: 20_000,
        markPrice: "0.5234"
      }
    ], [
      { symbol: "ETHUSD1", fundingIntervalHours: 8 },
      { symbol: "ZORAUSDT", fundingIntervalHours: 4 }
    ]);

    expect(result).toEqual([
      {
        symbol: "ZORAUSDT",
        fundingRate: 0.00005,
        cycleLabel: "4h",
        settlementTimeMs: 20_000
      }
    ]);
  });
});
