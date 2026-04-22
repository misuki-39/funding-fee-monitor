import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "../../shared/api/client.js";
import { queryKeys } from "../../shared/api/queryKeys.js";
import type { AssetDetailResponse, AssetFundingHistoryResponse } from "../../shared/types/api.js";

export const ASSET_DETAIL_REFRESH_MS = 60 * 1000;

function getAssetDetail(base: string) {
  return fetchJson<AssetDetailResponse>(`/api/assets/${encodeURIComponent(base)}`);
}

function getAssetHistory(base: string, days: number) {
  return fetchJson<AssetFundingHistoryResponse>(`/api/assets/${encodeURIComponent(base)}/history?days=${days}`);
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

export function useAssetHistoryQuery(base: string, days: number) {
  return useQuery({
    queryKey: queryKeys.assetHistory(base, days),
    queryFn: () => getAssetHistory(base, days),
    enabled: base.length > 0
  });
}
