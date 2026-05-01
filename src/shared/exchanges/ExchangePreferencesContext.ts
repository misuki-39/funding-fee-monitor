import { createContext, useContext, useMemo } from "react";
import { MARKETS, MARKET_KEYS } from "../config/markets.js";
import type { MarketConfig, MarketKey } from "../types/market.js";

export interface ExchangePreferencesValue {
  disabled: ReadonlySet<MarketKey>;
  toggle: (market: MarketKey) => void;
}

export const ExchangePreferencesContext = createContext<ExchangePreferencesValue | null>(null);

export function useDisabledExchanges(): ExchangePreferencesValue {
  const value = useContext(ExchangePreferencesContext);
  if (!value) {
    throw new Error("useDisabledExchanges must be used inside ExchangePreferencesProvider");
  }
  return value;
}

export function useEnabledMarkets(): MarketConfig[] {
  const { disabled } = useDisabledExchanges();
  return useMemo(
    () => Object.values(MARKETS).filter((market) => !disabled.has(market.key)),
    [disabled]
  );
}

export function useEnabledMarketKeys(): MarketKey[] {
  const { disabled } = useDisabledExchanges();
  return useMemo(() => MARKET_KEYS.filter((key) => !disabled.has(key)), [disabled]);
}
