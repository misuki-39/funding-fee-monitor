import { queryOptions, useQuery } from "@tanstack/react-query";
import { fetchJson } from "../../shared/api/client.js";
import { queryKeys } from "../../shared/api/queryKeys.js";
import type { FundingRatesResponse } from "../../shared/types/api.js";
import type { MarketKey } from "../../shared/types/market.js";

export const FUNDING_RATES_CACHE_MS = 5 * 60 * 1000;

function getFundingRates(market: MarketKey) {
  return fetchJson<FundingRatesResponse>(`/api/markets/${market}/funding-rates`);
}

export function fundingRatesQueryOptions(market: MarketKey) {
  return queryOptions({
    queryKey: queryKeys.fundingRates(market),
    queryFn: () => getFundingRates(market),
    staleTime: FUNDING_RATES_CACHE_MS,
    gcTime: FUNDING_RATES_CACHE_MS
  });
}

export function useFundingRatesQuery(market: MarketKey) {
  return useQuery(fundingRatesQueryOptions(market));
}
