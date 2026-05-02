import { isMarketKey } from "../../../shared/config/markets.js";
import type { MarketKey } from "../../../shared/types/market.js";

const HISTORY_PREFERENCES_STORAGE_KEY = "asset-history-preferences-v1";

export const HISTORY_MARKET_ORDER: MarketKey[] = ["binance", "okx", "gate", "bitget", "bybit", "grvt", "aster", "hyperliquid"];
export const DEFAULT_GLOBAL_HISTORY_MARKETS: MarketKey[] = ["binance", "okx"];

interface HistoryPreferences {
  globalDefaultMarkets: MarketKey[];
  perBaseMarkets: Record<string, MarketKey[]>;
}

function getDefaultHistoryPreferences(): HistoryPreferences {
  return {
    globalDefaultMarkets: [...DEFAULT_GLOBAL_HISTORY_MARKETS],
    perBaseMarkets: {}
  };
}

function getLocalStorage(): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage;
}

function normalizeBase(base: string): string {
  return base.trim().toUpperCase();
}

export function sortHistoryMarkets(markets: MarketKey[]): MarketKey[] {
  const selected = new Set(markets);
  return HISTORY_MARKET_ORDER.filter((market) => selected.has(market));
}

function sameHistoryMarkets(left: MarketKey[], right: MarketKey[]): boolean {
  return left.length === right.length && left.every((market, index) => market === right[index]);
}

function sanitizeMarketList(value: unknown): MarketKey[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const validMarkets = value.filter((market): market is MarketKey => typeof market === "string" && isMarketKey(market));
  return sortHistoryMarkets(validMarkets);
}

function cleanupPerBaseMarkets(
  perBaseMarkets: Record<string, MarketKey[]>,
  globalDefaultMarkets: MarketKey[]
): Record<string, MarketKey[]> {
  return Object.fromEntries(
    Object.entries(perBaseMarkets).flatMap(([base, markets]) => {
      const sanitized = sanitizeMarketList(markets);

      if (!base || sameHistoryMarkets(sanitized, globalDefaultMarkets)) {
        return [];
      }

      return [[base, sanitized] as const];
    })
  );
}

export function readHistoryPreferences(): HistoryPreferences {
  const storage = getLocalStorage();

  if (!storage) {
    return getDefaultHistoryPreferences();
  }

  try {
    const raw = storage.getItem(HISTORY_PREFERENCES_STORAGE_KEY);

    if (!raw) {
      return getDefaultHistoryPreferences();
    }

    const parsed = JSON.parse(raw) as Partial<HistoryPreferences>;
    const globalDefaultMarkets = sanitizeMarketList(parsed.globalDefaultMarkets);
    const safeGlobalDefaultMarkets = globalDefaultMarkets.length > 0 ? globalDefaultMarkets : [...DEFAULT_GLOBAL_HISTORY_MARKETS];
    const perBaseMarkets = cleanupPerBaseMarkets(parsed.perBaseMarkets ?? {}, safeGlobalDefaultMarkets);

    return {
      globalDefaultMarkets: safeGlobalDefaultMarkets,
      perBaseMarkets
    };
  } catch {
    return getDefaultHistoryPreferences();
  }
}

function writeHistoryPreferences(preferences: HistoryPreferences) {
  const storage = getLocalStorage();

  if (!storage) {
    return;
  }

  storage.setItem(HISTORY_PREFERENCES_STORAGE_KEY, JSON.stringify(preferences));
}

export function getInitialHistoryMarkets(base: string): MarketKey[] {
  const preferences = readHistoryPreferences();
  return preferences.perBaseMarkets[normalizeBase(base)] ?? preferences.globalDefaultMarkets;
}

export function pickInitialHistoryMarkets(base: string, availableMarkets: MarketKey[]): MarketKey[] {
  if (availableMarkets.length === 0) {
    return [];
  }

  const availableSet = new Set(availableMarkets);
  const persisted = getInitialHistoryMarkets(base);
  const intersection = persisted.filter((market) => availableSet.has(market));

  if (intersection.length > 0) {
    return intersection;
  }

  if (availableMarkets.length === 1) {
    return [availableMarkets[0]];
  }

  return [...availableMarkets].sort().slice(0, 2);
}

export function persistBaseHistoryMarkets(base: string, markets: MarketKey[]): void {
  const preferences = readHistoryPreferences();
  const normalizedBase = normalizeBase(base);
  const normalizedMarkets = sortHistoryMarkets(markets);
  const nextPerBaseMarkets = { ...preferences.perBaseMarkets, [normalizedBase]: normalizedMarkets };

  writeHistoryPreferences({
    globalDefaultMarkets: preferences.globalDefaultMarkets,
    perBaseMarkets: cleanupPerBaseMarkets(nextPerBaseMarkets, preferences.globalDefaultMarkets)
  });
}

