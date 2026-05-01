import { isMarketKey } from "../config/markets.js";
import type { MarketKey } from "../types/market.js";

const DISABLED_EXCHANGES_STORAGE_KEY = "disabled-exchanges-v1";

function getLocalStorage(): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage;
}

export function readDisabledExchanges(): MarketKey[] {
  const storage = getLocalStorage();

  if (!storage) {
    return [];
  }

  try {
    const raw = storage.getItem(DISABLED_EXCHANGES_STORAGE_KEY);

    if (!raw) {
      return [];
    }

    const parsed: unknown = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((value): value is MarketKey => typeof value === "string" && isMarketKey(value));
  } catch {
    return [];
  }
}

export function persistDisabledExchanges(disabled: MarketKey[]): void {
  const storage = getLocalStorage();

  if (!storage) {
    return;
  }

  storage.setItem(DISABLED_EXCHANGES_STORAGE_KEY, JSON.stringify(disabled));
}
