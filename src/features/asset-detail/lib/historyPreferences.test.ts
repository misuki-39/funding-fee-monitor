import { beforeEach, describe, expect, test } from "vitest";
import {
  getGlobalDefaultHistoryMarkets,
  getInitialHistoryMarkets,
  persistBaseHistoryMarkets,
  persistGlobalDefaultHistoryMarkets,
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
});
