import { MARKETS, MARKET_COLORS } from "../config/markets.js";
import type { MarketKey } from "../types/market.js";
import styles from "./SourceChips.module.css";

interface SourceChipsProps {
  sources: Record<MarketKey, string>;
  marketKeys: readonly MarketKey[];
}

export function SourceChips({ sources, marketKeys }: SourceChipsProps) {
  return (
    <div className={styles.row}>
      {marketKeys.map((key) => (
        <span key={key} className={styles.chip}>
          <span className={styles.dot} style={{ background: MARKET_COLORS[key] }} aria-hidden />
          <span className={styles.label}>{MARKETS[key].label}</span>
          <span className={styles.endpoint}>{sources[key]}</span>
        </span>
      ))}
    </div>
  );
}
