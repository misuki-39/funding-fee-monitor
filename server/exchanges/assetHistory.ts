import { buildAssetSymbol } from "../../src/shared/lib/assets.js";
import type { AssetFundingHistoryMarketData, AssetFundingHistoryRow, MarketKey } from "../../src/shared/types/market.js";
import { fetchAsterAssetHistory } from "./aster.js";
import { fetchBinanceAssetHistory } from "./binance.js";
import { fetchBitgetAssetHistory } from "./bitget.js";
import { fetchBybitAssetHistory } from "./bybit.js";
import { fetchGateAssetHistory } from "./gate.js";
import { fetchGrvtAssetHistory } from "./grvt.js";
import { fetchHyperliquidAssetHistory } from "./hyperliquid.js";
import { fetchOkxAssetHistory } from "./okx.js";

const assetHistoryFetchers: Record<MarketKey, (symbol: string, startTimeMs: number, endTimeMs: number) => Promise<AssetFundingHistoryMarketData>> = {
  okx: fetchOkxAssetHistory,
  binance: fetchBinanceAssetHistory,
  gate: fetchGateAssetHistory,
  bitget: fetchBitgetAssetHistory,
  bybit: fetchBybitAssetHistory,
  grvt: fetchGrvtAssetHistory,
  aster: fetchAsterAssetHistory,
  hyperliquid: fetchHyperliquidAssetHistory
};

export function createAssetHistoryRow(
  market: MarketKey,
  base: string,
  symbol: string,
  detail: AssetFundingHistoryMarketData | null,
  errorMessage: string | null
): AssetFundingHistoryRow {
  if (!detail) {
    return {
      market,
      base,
      symbol,
      points: [],
      pricePoints: [],
      available: false,
      errorMessage
    };
  }

  return {
    market,
    base,
    symbol: detail.symbol,
    points: detail.points,
    pricePoints: detail.pricePoints,
    available: true,
    errorMessage
  };
}

export async function fetchAssetHistoryRow(base: string, market: MarketKey, days: number, nowMs = Date.now()): Promise<AssetFundingHistoryRow> {
  const startTimeMs = nowMs - days * 24 * 60 * 60 * 1000;
  const symbol = buildAssetSymbol(market, base);
  const detail = await assetHistoryFetchers[market](symbol, startTimeMs, nowMs);

  return createAssetHistoryRow(market, base, symbol, detail, null);
}
