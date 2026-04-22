import { buildAssetSymbol } from "../../src/shared/lib/assets.js";
import type { AssetFundingHistoryMarketData, AssetFundingHistoryRow, MarketKey } from "../../src/shared/types/market.js";
import { fetchBinanceAssetHistory } from "./binance.js";
import { fetchGateAssetHistory } from "./gate.js";
import { fetchOkxAssetHistory } from "./okx.js";

const historyMarketOrder: MarketKey[] = ["okx", "binance", "gate"];

const assetHistoryFetchers: Record<MarketKey, (symbol: string, startTimeMs: number, endTimeMs: number) => Promise<AssetFundingHistoryMarketData>> = {
  okx: fetchOkxAssetHistory,
  binance: fetchBinanceAssetHistory,
  gate: fetchGateAssetHistory
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

export async function fetchAssetHistoryRows(base: string, days: number, nowMs = Date.now()): Promise<AssetFundingHistoryRow[]> {
  const startTimeMs = nowMs - days * 24 * 60 * 60 * 1000;

  return Promise.all(historyMarketOrder.map(async (market) => {
    const symbol = buildAssetSymbol(market, base);

    try {
      const detail = await assetHistoryFetchers[market](symbol, startTimeMs, nowMs);
      return createAssetHistoryRow(market, base, symbol, detail, null);
    } catch (error) {
      return createAssetHistoryRow(
        market,
        base,
        symbol,
        null,
        error instanceof Error ? error.message : String(error)
      );
    }
  }));
}
