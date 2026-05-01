import { useEffect } from "react";
import { MARKETS } from "../../../shared/config/markets.js";
import type { MarketKey } from "../../../shared/types/market.js";

const MARKET_ORDER = Object.keys(MARKETS) as MarketKey[];

interface KeyboardShortcutsOptions {
  onSelectMarket: (market: MarketKey) => void;
  onRefresh: () => void;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return target.isContentEditable;
}

export function useKeyboardShortcuts({ onSelectMarket, onRefresh }: KeyboardShortcutsOptions) {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;

      if (event.key === "r" || event.key === "R") {
        event.preventDefault();
        onRefresh();
        return;
      }

      const digit = Number.parseInt(event.key, 10);
      if (!Number.isNaN(digit) && digit >= 1 && digit <= MARKET_ORDER.length) {
        event.preventDefault();
        onSelectMarket(MARKET_ORDER[digit - 1]);
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onSelectMarket, onRefresh]);
}
