import { fetchBinanceRows } from "../exchanges/binance.js";
import { fetchBitgetRows } from "../exchanges/bitget.js";
import { fetchBybitRows } from "../exchanges/bybit.js";
import { fetchGateRows } from "../exchanges/gate.js";
import { fetchGrvtRows } from "../exchanges/grvt.js";
import { fetchOkxRows } from "../exchanges/okx.js";
import type { FundingRow, MarketKey } from "../../src/shared/types/market.js";

const marketFetchers: Record<MarketKey, () => Promise<FundingRow[]>> = {
  okx: fetchOkxRows,
  binance: fetchBinanceRows,
  gate: fetchGateRows,
  bitget: fetchBitgetRows,
  bybit: fetchBybitRows,
  grvt: fetchGrvtRows
};

export function fetchFundingRatesByMarket(market: MarketKey) {
  return marketFetchers[market]();
}
