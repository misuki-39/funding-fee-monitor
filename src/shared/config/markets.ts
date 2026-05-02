import type { MarketConfig, MarketKey } from "../types/market.js";

export const PAGE_SIZE = 10;
export const ASSET_DETAIL_SOURCE_LABEL =
  "Binance premiumIndex + fundingInfo | OKX funding-rate + mark-price | Gate contract detail | Bitget current-fund-rate + symbol-price | Bybit tickers + instruments-info | GRVT ticker + instrument | Aster premiumIndex + fundingInfo";
export const ASSET_HISTORY_SOURCE_LABEL =
  "Binance fundingRate | OKX funding-rate-history + history-mark-price-candles | Gate funding_rate + candlesticks | Bitget history-fund-rate + candles(MARK) | Bybit funding/history + mark-price-kline | GRVT funding + kline(MARK) | Aster fundingRate + markPriceKlines";

export const MARKET_KEYS: MarketKey[] = ["okx", "binance", "gate", "bitget", "bybit", "grvt", "aster"];

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
  }
};

export function isMarketKey(value: string): value is MarketKey {
  return value === "okx" || value === "binance" || value === "gate" || value === "bitget" || value === "bybit" || value === "grvt" || value === "aster";
}
