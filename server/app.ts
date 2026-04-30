import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { ASSET_DETAIL_SOURCE_LABEL, MARKETS, isMarketKey } from "../src/shared/config/markets.js";
import type {
  AssetDetailResponse,
  AssetFundingHistoryMarketResponse,
  FundingRatesResponse,
  HealthResponse
} from "../src/shared/types/api.js";
import type { AssetDetailRow, AssetFundingHistoryRow, FundingRow, MarketKey } from "../src/shared/types/market.js";
import { fetchAssetDetails } from "./services/assetDetails.js";
import { fetchAssetHistoryByMarket } from "./services/assetHistory.js";
import { fetchFundingRatesByMarket } from "./services/fundingRates.js";

const ASSET_HISTORY_CACHE_CONTROL = "public, max-age=0, s-maxage=900, stale-while-revalidate=60";
const FUNDING_CACHE_CONTROL = "public, max-age=0, s-maxage=30, stale-while-revalidate=60";

interface AppDependencies {
  getFundingRates: (market: MarketKey) => Promise<FundingRow[]>;
  getAssetDetails: (base: string) => Promise<AssetDetailRow[]>;
  getAssetHistoryByMarket: (base: string, market: MarketKey, days: number) => Promise<AssetFundingHistoryRow>;
  now: () => number;
}

const defaultDependencies: AppDependencies = {
  getFundingRates: fetchFundingRatesByMarket,
  getAssetDetails: fetchAssetDetails,
  getAssetHistoryByMarket: fetchAssetHistoryByMarket,
  now: () => Date.now()
};

export function createApiApp(dependencies: AppDependencies = defaultDependencies) {
  const app = new Hono();

  app.get("/health", (c) => {
    const response: HealthResponse = {
      status: "ok",
      timestamp: dependencies.now()
    };

    return c.json(response);
  });

  app.get("/markets/:market/funding-rates", async (c) => {
    const marketValue = c.req.param("market");

    if (!isMarketKey(marketValue)) {
      throw new HTTPException(400, { message: `Unsupported market: ${marketValue}` });
    }

    const rows = await dependencies.getFundingRates(marketValue);
    const response: FundingRatesResponse = {
      market: marketValue,
      rows,
      fetchedAt: dependencies.now(),
      sourceUrl: MARKETS[marketValue].sourceUrl
    };

    c.header("Cache-Control", FUNDING_CACHE_CONTROL);
    return c.json(response);
  });

  app.get("/assets/:base", async (c) => {
    const base = c.req.param("base");

    if (!base) {
      throw new HTTPException(400, { message: "Missing asset base" });
    }

    const rows = await dependencies.getAssetDetails(base);
    const response: AssetDetailResponse = {
      base,
      rows,
      fetchedAt: dependencies.now(),
      sourceLabel: ASSET_DETAIL_SOURCE_LABEL
    };

    c.header("Cache-Control", FUNDING_CACHE_CONTROL);
    return c.json(response);
  });

  app.get("/assets/:base/history/:market", async (c) => {
    const base = c.req.param("base");
    const marketValue = c.req.param("market");
    const daysValue = c.req.query("days") ?? "7";
    const days = Number(daysValue);

    if (!base) {
      throw new HTTPException(400, { message: "Missing asset base" });
    }

    if (!isMarketKey(marketValue)) {
      throw new HTTPException(400, { message: `Unsupported market: ${marketValue}` });
    }

    if (!Number.isInteger(days) || days < 1 || days > 14) {
      throw new HTTPException(400, { message: `Invalid history days: ${daysValue}` });
    }

    const row = await dependencies.getAssetHistoryByMarket(base, marketValue, days);
    const response: AssetFundingHistoryMarketResponse = {
      base,
      market: marketValue,
      days,
      row,
      fetchedAt: dependencies.now()
    };

    c.header("Cache-Control", ASSET_HISTORY_CACHE_CONTROL);
    return c.json(response);
  });

  return app;
}
