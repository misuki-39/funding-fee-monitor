import { describe, expect, test } from "vitest";
import { queryKeys } from "../../shared/api/queryKeys.js";
import { ASSET_HISTORY_CACHE_MS, assetHistoryMarketQueryOptions } from "./api.js";

describe("assetHistoryMarketQueryOptions", () => {
  test("keeps per-market history data fresh and cached for fifteen minutes", () => {
    const options = assetHistoryMarketQueryOptions("WAL", "binance", 7);

    expect(options.queryKey).toEqual(queryKeys.assetHistoryMarket("WAL", "binance", 7));
    expect(options.staleTime).toBe(ASSET_HISTORY_CACHE_MS);
    expect(options.gcTime).toBe(ASSET_HISTORY_CACHE_MS);
  });
});
