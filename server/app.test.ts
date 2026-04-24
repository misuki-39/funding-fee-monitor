import { describe, expect, test, vi } from "vitest";
import type { AssetDetailResponse, AssetFundingHistoryResponse, FundingRatesResponse } from "../src/shared/types/api.js";
import { createApiApp } from "./app.js";

describe("api app", () => {
  test("returns funding rates response for a supported market", async () => {
    const getFundingRates = vi.fn().mockResolvedValue([
      { symbol: "WALUSDT", fundingRate: 0.0001, cycleLabel: "8h", settlementTimeMs: 1_000 }
    ]);
    const app = createApiApp({
      getFundingRates,
      getAssetDetails: vi.fn(),
      getAssetHistory: vi.fn(),
      now: () => 123
    });

    const response = await app.request("/markets/binance/funding-rates");
    const payload = await response.json() as FundingRatesResponse;

    expect(response.status).toBe(200);
    expect(payload.market).toBe("binance");
    expect(payload.fetchedAt).toBe(123);
    expect(payload.rows).toHaveLength(1);
  });

  test("returns funding rates response for bitget", async () => {
    const getFundingRates = vi.fn().mockResolvedValue([
      { symbol: "WALUSDT", fundingRate: 0.0001, cycleLabel: "4h", settlementTimeMs: 1_000 }
    ]);
    const app = createApiApp({
      getFundingRates,
      getAssetDetails: vi.fn(),
      getAssetHistory: vi.fn(),
      now: () => 321
    });

    const response = await app.request("/markets/bitget/funding-rates");
    const payload = await response.json() as FundingRatesResponse;

    expect(response.status).toBe(200);
    expect(payload.market).toBe("bitget");
    expect(payload.fetchedAt).toBe(321);
    expect(payload.rows[0]?.symbol).toBe("WALUSDT");
  });

  test("returns asset detail response", async () => {
    const getAssetDetails = vi.fn().mockResolvedValue([
      {
        market: "gate",
        base: "龙虾",
        symbol: "龙虾_USDT",
        fundingRate: 0.0001,
        markPrice: 1.23,
        cycleLabel: "8h",
        available: true,
        errorMessage: null
      }
    ]);
    const app = createApiApp({
      getFundingRates: vi.fn(),
      getAssetDetails,
      getAssetHistory: vi.fn(),
      now: () => 456
    });

    const response = await app.request("/assets/%E9%BE%99%E8%99%BE");
    const payload = await response.json() as AssetDetailResponse;

    expect(response.status).toBe(200);
    expect(payload.base).toBe("龙虾");
    expect(payload.fetchedAt).toBe(456);
    expect(payload.rows[0].symbol).toBe("龙虾_USDT");
    expect(payload.rows[0].cycleLabel).toBe("8h");
  });

  test("rejects unsupported markets", async () => {
    const app = createApiApp({
      getFundingRates: vi.fn(),
      getAssetDetails: vi.fn(),
      getAssetHistory: vi.fn(),
      now: () => 0
    });

    const response = await app.request("/markets/bybit/funding-rates");

    expect(response.status).toBe(400);
  });

  test("returns asset funding history response", async () => {
    const getAssetHistory = vi.fn().mockResolvedValue([
      {
        market: "okx",
        base: "龙虾",
        symbol: "龙虾-USDT-SWAP",
        points: [
          { fundingTimeMs: 1_000, fundingRate: 0.0001 }
        ],
        pricePoints: [
          { timeMs: 1_000, price: 1.23 }
        ],
        available: true,
        errorMessage: null
      }
    ]);
    const app = createApiApp({
      getFundingRates: vi.fn(),
      getAssetDetails: vi.fn(),
      getAssetHistory,
      now: () => 789
    });

    const response = await app.request("/assets/%E9%BE%99%E8%99%BE/history?days=7");
    const payload = await response.json() as AssetFundingHistoryResponse;

    expect(response.status).toBe(200);
    expect(payload.base).toBe("龙虾");
    expect(payload.days).toBe(7);
    expect(payload.fetchedAt).toBe(789);
    expect(payload.rows[0].pricePoints[0]?.price).toBe(1.23);
  });
});
