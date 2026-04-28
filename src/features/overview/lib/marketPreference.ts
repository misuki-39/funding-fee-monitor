import { isMarketKey } from "../../../shared/config/markets.js";
import type { MarketKey } from "../../../shared/types/market.js";

const OVERVIEW_MARKET_STORAGE_KEY = "overview-market-v1";

export const DEFAULT_OVERVIEW_MARKET: MarketKey = "okx";

function getLocalStorage(): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage;
}

export function readOverviewMarket(): MarketKey {
  const storage = getLocalStorage();

  if (!storage) {
    return DEFAULT_OVERVIEW_MARKET;
  }

  try {
    const raw = storage.getItem(OVERVIEW_MARKET_STORAGE_KEY);

    if (raw && isMarketKey(raw)) {
      return raw;
    }
  } catch {
    // Ignore storage access errors and fall back to the default.
  }

  return DEFAULT_OVERVIEW_MARKET;
}

export function persistOverviewMarket(market: MarketKey): void {
  const storage = getLocalStorage();

  if (!storage) {
    return;
  }

  storage.setItem(OVERVIEW_MARKET_STORAGE_KEY, market);
}
