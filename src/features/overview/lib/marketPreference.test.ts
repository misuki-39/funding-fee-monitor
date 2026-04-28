import { beforeEach, describe, expect, test } from "vitest";
import { DEFAULT_OVERVIEW_MARKET, persistOverviewMarket, readOverviewMarket } from "./marketPreference.js";

const overviewMarketStorageKey = "overview-market-v1";

describe("marketPreference", () => {
  beforeEach(() => {
    window.localStorage.removeItem(overviewMarketStorageKey);
  });

  test("falls back to the default market when no preference is stored", () => {
    expect(readOverviewMarket()).toBe(DEFAULT_OVERVIEW_MARKET);
  });

  test("round-trips a persisted market selection", () => {
    persistOverviewMarket("bitget");

    expect(readOverviewMarket()).toBe("bitget");
  });

  test("ignores invalid stored values", () => {
    window.localStorage.setItem(overviewMarketStorageKey, "not-a-market");

    expect(readOverviewMarket()).toBe(DEFAULT_OVERVIEW_MARKET);
  });
});
