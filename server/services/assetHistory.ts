import { fetchAssetHistoryRows } from "../exchanges/assetHistory.js";

export function fetchAssetHistory(base: string, days: number) {
  return fetchAssetHistoryRows(base, days);
}
