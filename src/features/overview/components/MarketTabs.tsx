import { MARKETS } from "../../../shared/config/markets.js";
import type { MarketKey } from "../../../shared/types/market.js";
import { Button } from "../../../shared/ui/Button.js";
import styles from "./MarketTabs.module.css";

type Size = "default" | "compact";

interface MarketTabsProps {
  currentMarket: MarketKey;
  disabled?: boolean;
  size?: Size;
  onSelect: (market: MarketKey) => void;
}

export function MarketTabs({ currentMarket, disabled = false, size = "default", onSelect }: MarketTabsProps) {
  const groupClass = size === "compact" ? `${styles.group} ${styles.compact}` : styles.group;

  return (
    <div className={groupClass} aria-label="Exchange selector">
      {Object.values(MARKETS).map((market) => {
        const isActive = market.key === currentMarket;

        return (
          <Button
            key={market.key}
            variant="secondary"
            className={isActive ? styles.active : ""}
            disabled={disabled || isActive}
            onClick={() => onSelect(market.key)}
          >
            {market.label}
          </Button>
        );
      })}
    </div>
  );
}
