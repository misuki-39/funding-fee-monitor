import { screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { OverviewPage } from "./OverviewPage.js";
import { renderWithQueryClient } from "../../test-utils.js";

vi.mock("./api.js", () => ({
  useFundingRatesQuery: () => ({
    data: {
      market: "okx",
      rows: [
        { symbol: "WAL-USDT-SWAP", fundingRate: 0.0001, cycleLabel: "8h", settlementTimeMs: Date.now() + 100000 }
      ],
      fetchedAt: 123,
      sourceUrl: "okx-source"
    },
    isPending: false,
    isError: false,
    isFetching: false,
    error: null,
    refetch: vi.fn()
  })
}));

describe("OverviewPage", () => {
  test("renders overview data and asset links", () => {
    renderWithQueryClient(<OverviewPage />);

    expect(screen.getByText("WAL-USDT-SWAP")).toBeInTheDocument();
    expect(screen.queryByText(/Loaded/)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "WAL-USDT-SWAP" })).toHaveAttribute("href", "/assets/WAL");
    expect(screen.getByRole("button", { name: "Bitget" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bybit" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "GRVT" })).toBeInTheDocument();
  });
});
