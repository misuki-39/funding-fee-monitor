import { buildAssetSymbol } from "../../src/shared/lib/assets.js";
import type { AssetDetailMarketData, AssetDetailRow, MarketKey } from "../../src/shared/types/market.js";
import { fetchBinanceAssetDetail } from "./binance.js";
import { fetchBitgetAssetDetail } from "./bitget.js";
import { fetchGateAssetDetail } from "./gate.js";
import { fetchOkxAssetDetail } from "./okx.js";

const detailMarketOrder: MarketKey[] = ["okx", "binance", "gate", "bitget"];

const assetDetailFetchers: Record<MarketKey, (symbol: string) => Promise<AssetDetailMarketData>> = {
  okx: fetchOkxAssetDetail,
  binance: fetchBinanceAssetDetail,
  gate: fetchGateAssetDetail,
  bitget: fetchBitgetAssetDetail
};

export function createAssetDetailRow(
  market: MarketKey,
  base: string,
  symbol: string,
  detail: AssetDetailMarketData | null,
  errorMessage: string | null
): AssetDetailRow {
  if (!detail) {
    return {
      market,
      base,
      symbol,
      fundingRate: null,
      markPrice: null,
      cycleLabel: null,
      available: false,
      errorMessage
    };
  }

  return {
    market,
    base,
    symbol: detail.symbol,
    fundingRate: detail.fundingRate,
    markPrice: detail.markPrice,
    cycleLabel: detail.cycleLabel,
    available: true,
    errorMessage
  };
}

export async function fetchAssetDetailRows(base: string): Promise<AssetDetailRow[]> {
  return Promise.all(detailMarketOrder.map(async (market) => {
    const symbol = buildAssetSymbol(market, base);

    try {
      const detail = await assetDetailFetchers[market](symbol);
      return createAssetDetailRow(market, base, symbol, detail, null);
    } catch (error) {
      return createAssetDetailRow(
        market,
        base,
        symbol,
        null,
        error instanceof Error ? error.message : String(error)
      );
    }
  }));
}
