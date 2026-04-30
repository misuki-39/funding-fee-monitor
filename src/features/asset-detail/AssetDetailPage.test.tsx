import { render, screen } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { createTestQueryClient } from "../../test-utils.js";
import { AssetDetailPage } from "./AssetDetailPage.js";

const historyPreferencesStorageKey = "asset-history-preferences-v1";

vi.mock("recharts", () => {
  function Div({ children }: { children?: ReactNode }) {
    return <div>{children}</div>;
  }

  function Null() {
    return null;
  }

  return {
    ResponsiveContainer: Div,
    LineChart: Div,
    CartesianGrid: Null,
    Legend: Null,
    Line: Null,
    Tooltip: Null,
    XAxis: Null,
    YAxis: Null
  };
});

const historyRowsByMarket = {
  binance: {
    market: "binance",
    base: "龙虾",
    symbol: "龙虾USDT",
    points: [
      { fundingTimeMs: 1_000, fundingRate: 0.0001 }
    ],
    pricePoints: [
      { timeMs: 1_000, price: 1.23 }
    ],
    available: true,
    errorMessage: null
  },
  okx: {
    market: "okx",
    base: "龙虾",
    symbol: "龙虾-USDT-SWAP",
    points: [
      { fundingTimeMs: 2_000, fundingRate: 0.00015 }
    ],
    pricePoints: [
      { timeMs: 2_000, price: 1.24 }
    ],
    available: true,
    errorMessage: null
  },
  gate: {
    market: "gate",
    base: "龙虾",
    symbol: "龙虾_USDT",
    points: [
      { fundingTimeMs: 3_000, fundingRate: 0.0002 }
    ],
    pricePoints: [
      { timeMs: 3_000, price: 1.25 }
    ],
    available: true,
    errorMessage: null
  },
  bitget: {
    market: "bitget",
    base: "龙虾",
    symbol: "龙虾USDT",
    points: [
      { fundingTimeMs: 4_000, fundingRate: -0.0003 }
    ],
    pricePoints: [
      { timeMs: 4_000, price: 1.22 }
    ],
    available: true,
    errorMessage: null
  },
  bybit: {
    market: "bybit",
    base: "龙虾",
    symbol: "龙虾USDT",
    points: [
      { fundingTimeMs: 5_000, fundingRate: 0.00025 }
    ],
    pricePoints: [
      { timeMs: 5_000, price: 1.27 }
    ],
    available: true,
    errorMessage: null
  },
  grvt: {
    market: "grvt",
    base: "龙虾",
    symbol: "龙虾_USDT_Perp",
    points: [
      { fundingTimeMs: 6_000, fundingRate: -0.00004 }
    ],
    pricePoints: [
      { timeMs: 6_000, price: 1.28 }
    ],
    available: true,
    errorMessage: null
  }
} as const;

vi.mock("./api.js", () => ({
  useAssetDetailQuery: () => ({
    data: {
      base: "龙虾",
      rows: [
        {
          market: "binance",
          base: "龙虾",
          symbol: "龙虾USDT",
          fundingRate: 0.0001,
          markPrice: 1.23,
          cycleLabel: "8h",
          available: true,
          errorMessage: null
        },
        {
          market: "gate",
          base: "龙虾",
          symbol: "龙虾_USDT",
          fundingRate: 0.0002,
          markPrice: 1.25,
          cycleLabel: "4h",
          available: true,
          errorMessage: null
        },
        {
          market: "bitget",
          base: "龙虾",
          symbol: "龙虾USDT",
          fundingRate: -0.0003,
          markPrice: 1.22,
          cycleLabel: "2h",
          available: true,
          errorMessage: null
        }
      ],
      fetchedAt: 456,
      sourceLabel: "detail-source"
    },
    isPending: false,
    isError: false,
    error: null
  }),
  useAssetHistoryQueries: (_base: string, days: number, markets: Array<keyof typeof historyRowsByMarket>) => markets.map((market) => ({
    data: {
      base: "龙虾",
      market,
      days,
      row: historyRowsByMarket[market],
      fetchedAt: 789,
      sourceLabel: `${market}-source`
    },
    isPending: false,
    isFetching: false,
    isError: false,
    error: null
  }))
}));

describe("AssetDetailPage", () => {
  beforeEach(() => {
    window.localStorage.removeItem(historyPreferencesStorageKey);
  });

  test("renders chinese-base asset detail rows", async () => {
    const router = createMemoryRouter(
      [{ path: "/assets/:base", element: <AssetDetailPage /> }],
      { initialEntries: ["/assets/%E9%BE%99%E8%99%BE"] }
    );

    const queryClient = createTestQueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    );

    expect(await screen.findByText("龙虾_USDT")).toBeInTheDocument();
    expect(screen.queryByText(/Loaded 龙虾 across/)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to Markets" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("columnheader", { name: "Hours" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Annualized" })).toBeInTheDocument();
    expect(screen.getByText("8h")).toBeInTheDocument();
    expect(screen.getByText("10.950%")).toBeInTheDocument();
    expect(screen.getAllByText("龙虾USDT").length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: "Funding History and Pairwise Cumulative Spread" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Apply" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /Binance Ready/i })).toBeChecked();
    expect(screen.queryByRole("checkbox", { name: /OKX/i })).not.toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /Gate\.io Not loaded/i })).not.toBeChecked();
    expect(screen.getByRole("heading", { name: "Funding + Price History" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Pairwise Cumulative Spread" })).toBeInTheDocument();
  });
});
