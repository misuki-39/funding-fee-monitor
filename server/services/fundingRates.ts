import { fetchBinanceRows } from "../exchanges/binance.js";
import { fetchGateRows } from "../exchanges/gate.js";
import { fetchOkxRows } from "../exchanges/okx.js";
import type { FundingRow, MarketKey } from "../../src/shared/types/market.js";

const marketFetchers: Record<MarketKey, () => Promise<FundingRow[]>> = {
  okx: fetchOkxRows,
  binance: fetchBinanceRows,
  gate: fetchGateRows
};

export function fetchFundingRatesByMarket(market: MarketKey) {
  return marketFetchers[market]();
}
