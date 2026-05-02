import { toCanonicalBase, toExchangeBase } from "../config/assetAliases.js";
import { HYPERLIQUID_BUILDER_DEXES } from "../config/markets.js";
import type { MarketKey } from "../types/market.js";

const binanceQuoteSuffixes = ["USDT", "USDC", "FDUSD", "BUSD", "TUSD"] as const;
const grvtSuffix = "_USDT_Perp";

export function extractBaseSymbol(market: MarketKey, symbol: string): string {
  if (!symbol) {
    throw new Error(`Invalid ${market} symbol: ${symbol}`);
  }

  const rawBase = extractRawBase(market, symbol);
  return toCanonicalBase(market, rawBase);
}

function extractRawBase(market: MarketKey, symbol: string): string {
  if (market === "binance" || market === "bitget" || market === "bybit" || market === "aster") {
    for (const quoteSuffix of binanceQuoteSuffixes) {
      if (symbol.endsWith(quoteSuffix)) {
        return symbol.slice(0, -quoteSuffix.length);
      }
    }

    const labels: Record<typeof market, string> = { binance: "Binance", bitget: "Bitget", bybit: "Bybit", aster: "Aster" };
    throw new Error(`Unsupported ${labels[market]} symbol: ${symbol}`);
  }

  if (market === "okx") {
    if (!symbol.includes("-")) {
      throw new Error(`Unsupported OKX symbol: ${symbol}`);
    }

    const [base] = symbol.split("-");
    return base ?? "";
  }

  if (market === "grvt") {
    if (!symbol.endsWith(grvtSuffix)) {
      throw new Error(`Unsupported GRVT symbol: ${symbol}`);
    }
    return symbol.slice(0, -grvtSuffix.length);
  }

  if (market === "hyperliquid") {
    for (const dex of HYPERLIQUID_BUILDER_DEXES) {
      const prefix = `${dex}:`;
      if (symbol.startsWith(prefix)) {
        return symbol.slice(prefix.length);
      }
    }
    return symbol;
  }

  if (!symbol.includes("_")) {
    throw new Error(`Unsupported Gate.io symbol: ${symbol}`);
  }

  const [base] = symbol.split("_");
  return base ?? "";
}

export function buildAssetSymbol(market: MarketKey, base: string): string {
  const exchangeBase = toExchangeBase(market, base);

  if (market === "binance" || market === "bitget" || market === "bybit" || market === "aster") {
    return `${exchangeBase}USDT`;
  }

  if (market === "okx") {
    return `${exchangeBase}-USDT-SWAP`;
  }

  if (market === "grvt") {
    return `${exchangeBase}${grvtSuffix}`;
  }

  if (market === "hyperliquid") {
    return exchangeBase;
  }

  return `${exchangeBase}_USDT`;
}
