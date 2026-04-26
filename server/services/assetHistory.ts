import type { MarketKey } from "../../src/shared/types/market.js";
import { fetchAssetHistoryRow } from "../exchanges/assetHistory.js";

export function fetchAssetHistoryByMarket(base: string, market: MarketKey, days: number) {
  return fetchAssetHistoryRow(base, market, days);
}
