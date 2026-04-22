import { render, screen } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { describe, expect, test, vi } from "vitest";
import { createTestQueryClient } from "../../test-utils.js";
import { AssetDetailPage } from "./AssetDetailPage.js";

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
        }
      ],
      fetchedAt: 456,
      sourceLabel: "detail-source"
    },
    isPending: false,
    isError: false,
    error: null
  }),
  useAssetHistoryQuery: () => ({
    data: {
      base: "龙虾",
      days: 7,
      rows: [
        {
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
        {
          market: "gate",
          base: "龙虾",
          symbol: "龙虾_USDT",
          points: [
            { fundingTimeMs: 2_000, fundingRate: 0.0002 }
          ],
          pricePoints: [
            { timeMs: 2_000, price: 1.25 }
          ],
          available: true,
          errorMessage: null
        }
      ],
      fetchedAt: 789,
      sourceLabel: "history-source"
    },
    isPending: false,
    isFetching: false,
    isError: false,
    error: null
  })
}));

describe("AssetDetailPage", () => {
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
    expect(screen.getByRole("heading", { name: "Funding History and Pairwise Cumulative Spread" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Apply" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Funding + Price History" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Pairwise Cumulative Spread" })).toBeInTheDocument();
  });
});
