import { beforeEach, describe, expect, test } from "vitest";
import {
  getGlobalDefaultHistoryMarkets,
  getInitialHistoryMarkets,
  persistBaseHistoryMarkets,
  persistGlobalDefaultHistoryMarkets,
  pickInitialHistoryMarkets,
  readHistoryPreferences
} from "./historyPreferences.js";

const historyPreferencesStorageKey = "asset-history-preferences-v1";

describe("historyPreferences", () => {
  beforeEach(() => {
    window.localStorage.removeItem(historyPreferencesStorageKey);
  });

  test("falls back to binance and okx for new assets", () => {
    expect(getGlobalDefaultHistoryMarkets()).toEqual(["binance", "okx"]);
    expect(getInitialHistoryMarkets("wal")).toEqual(["binance", "okx"]);
  });

  test("stores and restores per-base exchange selections", () => {
    persistBaseHistoryMarkets("wal", ["gate", "binance"]);

    expect(getInitialHistoryMarkets("WAL")).toEqual(["binance", "gate"]);
  });

  test("removes per-base overrides that match the global default", () => {
    persistBaseHistoryMarkets("wal", ["binance", "okx"]);

    expect(readHistoryPreferences().perBaseMarkets).toEqual({});
  });

  test("updates the global default and removes redundant overrides", () => {
    persistBaseHistoryMarkets("wal", ["binance", "gate"]);
    const next = persistGlobalDefaultHistoryMarkets(["binance", "gate"]);

    expect(next).toEqual(["binance", "gate"]);
    expect(getGlobalDefaultHistoryMarkets()).toEqual(["binance", "gate"]);
    expect(readHistoryPreferences().perBaseMarkets).toEqual({});
    expect(getInitialHistoryMarkets("new")).toEqual(["binance", "gate"]);
  });

  describe("pickInitialHistoryMarkets", () => {
    test("returns persisted selection when fully available", () => {
      expect(pickInitialHistoryMarkets("wal", ["binance", "okx", "gate"])).toEqual(["binance", "okx"]);
    });

    test("falls back to alphabetical first two when persisted has no overlap", () => {
      expect(pickInitialHistoryMarkets("wal", ["bybit", "grvt"])).toEqual(["bybit", "grvt"]);
      expect(pickInitialHistoryMarkets("wal", ["bybit", "grvt", "gate"])).toEqual(["bybit", "gate"]);
    });

    test("returns empty when nothing is available", () => {
      expect(pickInitialHistoryMarkets("wal", [])).toEqual([]);
    });

    test("keeps the partial intersection without padding", () => {
      persistBaseHistoryMarkets("wal", ["binance", "gate"]);

      expect(pickInitialHistoryMarkets("WAL", ["binance", "bybit"])).toEqual(["binance"]);
    });

    test("returns the lone available exchange when intersection is empty", () => {
      expect(pickInitialHistoryMarkets("wal", ["gate"])).toEqual(["gate"]);
    });
  });
});
