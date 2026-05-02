import type { MarketConfig, MarketKey } from "../types/market.js";

export const PAGE_SIZE = 10;

export const ASSET_DETAIL_SOURCES: Record<MarketKey, string> = {
  okx: "funding-rate + mark-price",
  binance: "premiumIndex + fundingInfo",
  gate: "contract detail",
  bitget: "current-fund-rate + symbol-price",
  bybit: "tickers + instruments-info",
  grvt: "ticker + instrument",
  aster: "premiumIndex + fundingInfo",
  hyperliquid: "metaAndAssetCtxs"
};

export const ASSET_HISTORY_SOURCES: Record<MarketKey, string> = {
  okx: "funding-rate-history + history-mark-price-candles",
  binance: "fundingRate + markPriceKlines",
  gate: "funding_rate + candlesticks",
  bitget: "history-fund-rate + candles(MARK)",
  bybit: "funding/history + mark-price-kline",
  grvt: "funding + kline(MARK)",
  aster: "fundingRate + markPriceKlines",
  hyperliquid: "fundingHistory + candleSnapshot"
};

export const MARKET_COLORS: Record<MarketKey, string> = {
  okx: "#9d3c17",
  binance: "#8c6a00",
  gate: "#11643c",
  bitget: "#1d4ed8",
  bybit: "#f59e0b",
  grvt: "#0ea5e9",
  aster: "#a855f7",
  hyperliquid: "#22c55e"
};

export const MARKET_KEYS: MarketKey[] = ["okx", "binance", "gate", "bitget", "bybit", "grvt", "aster", "hyperliquid"];

export const MARKETS: Record<MarketKey, MarketConfig> = {
  okx: {
    key: "okx",
    label: "OKX",
    title: "OKX Funding Rate",
    sourceUrl: "https://www.okx.com/api/v5/public/funding-rate?instId=ANY"
  },
  binance: {
    key: "binance",
    label: "Binance",
    title: "Binance Funding Rate",
    sourceUrl: "https://fapi.binance.com/fapi/v1/premiumIndex + /fapi/v1/fundingInfo"
  },
  gate: {
    key: "gate",
    label: "Gate.io",
    title: "Gate.io Funding Rate",
    sourceUrl: "https://api.gateio.ws/api/v4/futures/usdt/contracts"
  },
  bitget: {
    key: "bitget",
    label: "Bitget",
    title: "Bitget Funding Rate",
    sourceUrl: "https://api.bitget.com/api/v2/mix/market/current-fund-rate?productType=usdt-futures"
  },
  bybit: {
    key: "bybit",
    label: "Bybit",
    title: "Bybit Funding Rate",
    sourceUrl: "https://api.bybit.com/v5/market/tickers?category=linear"
  },
  grvt: {
    key: "grvt",
    label: "GRVT",
    title: "GRVT Funding Rate",
    sourceUrl: "https://market-data.grvt.io/full/v1/all_instruments + /full/v1/ticker"
  },
  aster: {
    key: "aster",
    label: "Aster",
    title: "Aster Funding Rate",
    sourceUrl: "https://fapi.asterdex.com/fapi/v3/premiumIndex + /fapi/v3/fundingInfo"
  },
  hyperliquid: {
    key: "hyperliquid",
    label: "Hyperliquid",
    title: "Hyperliquid Funding Rate",
    sourceUrl: "https://api.hyperliquid.xyz/info (metaAndAssetCtxs)"
  }
};

export function isMarketKey(value: string): value is MarketKey {
  return value === "okx" || value === "binance" || value === "gate" || value === "bitget" || value === "bybit" || value === "grvt" || value === "aster" || value === "hyperliquid";
}
