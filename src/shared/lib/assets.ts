import type { MarketKey } from "../types/market.js";

const binanceQuoteSuffixes = ["USDT", "USDC", "FDUSD", "BUSD", "TUSD"] as const;

export function extractBaseSymbol(market: MarketKey, symbol: string): string {
  if (!symbol) {
    throw new Error(`Invalid ${market} symbol: ${symbol}`);
  }

  if (market === "binance" || market === "bitget" || market === "bybit") {
    for (const quoteSuffix of binanceQuoteSuffixes) {
      if (symbol.endsWith(quoteSuffix)) {
        return symbol.slice(0, -quoteSuffix.length);
      }
    }

    const labels: Record<typeof market, string> = { binance: "Binance", bitget: "Bitget", bybit: "Bybit" };
    throw new Error(`Unsupported ${labels[market]} symbol: ${symbol}`);
  }

  if (market === "okx") {
    if (!symbol.includes("-")) {
      throw new Error(`Unsupported OKX symbol: ${symbol}`);
    }

    const [base] = symbol.split("-");
    return base ?? "";
  }

  if (!symbol.includes("_")) {
    throw new Error(`Unsupported Gate.io symbol: ${symbol}`);
  }

  const [base] = symbol.split("_");
  return base ?? "";
}

export function buildAssetSymbol(market: MarketKey, base: string): string {
  if (market === "binance" || market === "bitget" || market === "bybit") {
    return `${base}USDT`;
  }

  if (market === "okx") {
    return `${base}-USDT-SWAP`;
  }

  return `${base}_USDT`;
}
