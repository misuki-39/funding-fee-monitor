import { describe, expect, test } from "vitest";
import { extractBaseSymbol, buildAssetSymbol } from "./assets.js";
import { filterRows } from "./filterRows.js";
import { formatAnnualizedRate, formatCycle, formatRate, formatTimeToSettlement, parseCycleHours } from "./formatters.js";
import { sortRows } from "./sortRows.js";

describe("shared market helpers", () => {
  test("formatCycle supports supported intervals", () => {
    expect(formatCycle(1)).toBe("1h");
    expect(formatCycle(2)).toBe("2h");
    expect(formatCycle(4)).toBe("4h");
    expect(formatCycle(8)).toBe("8h");
    expect(() => formatCycle(3)).toThrow(/Unexpected funding interval/);
  });

  test("formatRate renders percentage text", () => {
    expect(formatRate(0.00005)).toBe("0.005%");
  });

  test("parseCycleHours and formatAnnualizedRate derive cycle-based metrics", () => {
    expect(parseCycleHours("4h")).toBe(4);
    expect(formatAnnualizedRate(0.0005, "4h")).toBe("109.500%");
  });

  test("formatTimeToSettlement renders relative time and settled state", () => {
    expect(formatTimeToSettlement(3_600_000, 0)).toBe("1h");
    expect(formatTimeToSettlement(3_900_000, 0)).toBe("1h 5m");
    expect(formatTimeToSettlement(50_000, 0)).toBe("0m");
    expect(formatTimeToSettlement(0, 0)).toBe("settled");
  });

  test("sortRows keeps funding primary and uses symbol tie-breaker", () => {
    const rows = [
      { symbol: "B", fundingRate: 0.01, cycleLabel: "8h" as const, settlementTimeMs: 1_000 },
      { symbol: "A", fundingRate: 0.01, cycleLabel: "8h" as const, settlementTimeMs: 9_000 },
      { symbol: "C", fundingRate: -0.02, cycleLabel: "8h" as const, settlementTimeMs: 1_000 }
    ];

    expect(sortRows(rows, "desc").map((row) => row.symbol)).toEqual(["A", "B", "C"]);
  });

  test("filterRows supports 1h, 4h and all", () => {
    const rows = [
      { symbol: "A", fundingRate: 0.01, cycleLabel: "1h" as const, settlementTimeMs: 30 * 60 * 1000 },
      { symbol: "B", fundingRate: 0.01, cycleLabel: "4h" as const, settlementTimeMs: 3 * 60 * 60 * 1000 },
      { symbol: "C", fundingRate: 0.01, cycleLabel: "8h" as const, settlementTimeMs: 6 * 60 * 60 * 1000 }
    ];

    expect(filterRows(rows, "1h", 0).map((row) => row.symbol)).toEqual(["A"]);
    expect(filterRows(rows, "4h", 0).map((row) => row.symbol)).toEqual(["A", "B"]);
    expect(filterRows(rows, "all", 0).map((row) => row.symbol)).toEqual(["A", "B", "C"]);
  });

  test("extractBaseSymbol supports documented exchange formats", () => {
    expect(extractBaseSymbol("binance", "WALUSDT")).toBe("WAL");
    expect(extractBaseSymbol("okx", "WAL-USDT-SWAP")).toBe("WAL");
    expect(extractBaseSymbol("gate", "WAL_USDT")).toBe("WAL");
    expect(extractBaseSymbol("gate", "龙虾_USDT")).toBe("龙虾");
  });

  test("buildAssetSymbol rebuilds detail symbols for all exchanges", () => {
    expect(buildAssetSymbol("binance", "wal")).toBe("walUSDT");
    expect(buildAssetSymbol("okx", "wal")).toBe("wal-USDT-SWAP");
    expect(buildAssetSymbol("gate", "wal")).toBe("wal_USDT");
    expect(buildAssetSymbol("gate", "龙虾")).toBe("龙虾_USDT");
  });

  test("extractBaseSymbol rejects unsupported exchange formats", () => {
    expect(() => extractBaseSymbol("okx", "WALUSDT")).toThrow(/Unsupported OKX symbol/);
  });
});
