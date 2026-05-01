import { useCallback, useEffect, useMemo, useState, type PropsWithChildren } from "react";
import { MARKET_KEYS } from "../config/markets.js";
import { persistDisabledExchanges, readDisabledExchanges } from "../lib/exchangePreferences.js";
import type { MarketKey } from "../types/market.js";
import { ExchangePreferencesContext, type ExchangePreferencesValue } from "./ExchangePreferencesContext.js";

export function ExchangePreferencesProvider({ children }: PropsWithChildren) {
  const [disabled, setDisabled] = useState<Set<MarketKey>>(() => new Set(readDisabledExchanges()));

  useEffect(() => {
    persistDisabledExchanges([...disabled]);
  }, [disabled]);

  const toggle = useCallback((market: MarketKey) => {
    setDisabled((current) => {
      const next = new Set(current);
      if (next.has(market)) {
        next.delete(market);
        return next;
      }
      if (MARKET_KEYS.length - next.size <= 1) {
        return current;
      }
      next.add(market);
      return next;
    });
  }, []);

  const value = useMemo<ExchangePreferencesValue>(() => ({ disabled, toggle }), [disabled, toggle]);

  return <ExchangePreferencesContext.Provider value={value}>{children}</ExchangePreferencesContext.Provider>;
}
