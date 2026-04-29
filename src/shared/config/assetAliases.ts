import type { MarketKey } from "../types/market.js";

const exchangeBaseAliases: Partial<Record<MarketKey, Record<string, string>>> = {
  okx: {
    AI: "AIGENSYN"
  }
};

const reverseAliases: Partial<Record<MarketKey, Record<string, string>>> = Object.fromEntries(
  Object.entries(exchangeBaseAliases).map(([market, forward]) => [
    market,
    Object.fromEntries(Object.entries(forward).map(([raw, canonical]) => [canonical, raw]))
  ])
);

export function toCanonicalBase(market: MarketKey, rawBase: string): string {
  return exchangeBaseAliases[market]?.[rawBase] ?? rawBase;
}

export function toExchangeBase(market: MarketKey, canonicalBase: string): string {
  return reverseAliases[market]?.[canonicalBase] ?? canonicalBase;
}
