import { queryOptions, useQueries, useQuery } from "@tanstack/react-query";
import { fetchJson } from "../../shared/api/client.js";
import { queryKeys } from "../../shared/api/queryKeys.js";
import type { AssetDetailResponse, AssetFundingHistoryMarketResponse } from "../../shared/types/api.js";
import type { MarketKey } from "../../shared/types/market.js";

export const ASSET_DETAIL_REFRESH_MS = 60 * 1000;
export const ASSET_HISTORY_CACHE_MS = 15 * 60 * 1000;

function getAssetDetail(base: string) {
  return fetchJson<AssetDetailResponse>(`/api/assets/${encodeURIComponent(base)}`);
}

function getAssetHistoryMarket(base: string, market: MarketKey, days: number) {
  return fetchJson<AssetFundingHistoryMarketResponse>(
    `/api/assets/${encodeURIComponent(base)}/history/${market}?days=${days}`
  );
}

export function useAssetDetailQuery(base: string) {
  return useQuery({
    queryKey: queryKeys.assetDetail(base),
    queryFn: () => getAssetDetail(base),
    enabled: base.length > 0,
    refetchInterval: ASSET_DETAIL_REFRESH_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true
  });
}

export function assetHistoryMarketQueryOptions(base: string, market: MarketKey, days: number) {
  return queryOptions({
    queryKey: queryKeys.assetHistoryMarket(base, market, days),
    queryFn: () => getAssetHistoryMarket(base, market, days),
    enabled: base.length > 0,
    staleTime: ASSET_HISTORY_CACHE_MS,
    gcTime: ASSET_HISTORY_CACHE_MS
  });
}

export function useAssetHistoryQueries(base: string, days: number, markets: MarketKey[]) {
  return useQueries({
    queries: markets.map((market) => assetHistoryMarketQueryOptions(base, market, days))
  });
}
