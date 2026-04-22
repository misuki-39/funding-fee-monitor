import { describe, expect, test } from "vitest";
import { queryKeys } from "../../shared/api/queryKeys.js";
import { FUNDING_RATES_CACHE_MS, fundingRatesQueryOptions } from "./api.js";

describe("fundingRatesQueryOptions", () => {
  test("keeps market funding data fresh and cached for five minutes", () => {
    const options = fundingRatesQueryOptions("okx");

    expect(options.queryKey).toEqual(queryKeys.fundingRates("okx"));
    expect(options.staleTime).toBe(FUNDING_RATES_CACHE_MS);
    expect(options.gcTime).toBe(FUNDING_RATES_CACHE_MS);
  });
});
