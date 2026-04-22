import { describe, expect, test } from "vitest";
import { mergeBinanceRows, normalizeBinanceAssetDetail, normalizeBinanceHistoryPoint } from "./binance.js";
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
});
