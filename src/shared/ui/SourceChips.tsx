import { MARKETS, MARKET_COLORS } from "../config/markets.js";
import type { MarketKey } from "../types/market.js";
import styles from "./SourceChips.module.css";

export type SourceChipStatus = "idle" | "loading" | "ready" | "failed";

const statusClass: Record<SourceChipStatus, string> = {
  idle: styles.statusIdle,
  loading: styles.statusLoading,
  ready: styles.statusReady,
  failed: styles.statusFailed
};

const statusLabel: Record<SourceChipStatus, string> = {
  idle: "Not loaded",
  loading: "Loading",
  ready: "Ready",
  failed: "Failed"
};

interface SourceChipsProps {
  sources: Record<MarketKey, string>;
  marketKeys: readonly MarketKey[];
  selectedKeys?: ReadonlySet<MarketKey>;
  onToggle?: (key: MarketKey) => void;
  statuses?: Partial<Record<MarketKey, SourceChipStatus>>;
}

export function SourceChips({ sources, marketKeys, selectedKeys, onToggle, statuses }: SourceChipsProps) {
  const interactive = onToggle != null;

  return (
    <div className={styles.row}>
      {marketKeys.map((key) => {
        const selected = !interactive || (selectedKeys?.has(key) ?? false);
        const status = statuses?.[key];
        const className = `${styles.chip} ${selected ? styles.selected : styles.unselected}`;

        const commonProps = interactive
          ? { type: "button" as const, "aria-pressed": selected, onClick: () => onToggle(key) }
          : { tabIndex: 0 };
        const Element = interactive ? "button" : "span";

        return (
          <Element key={key} className={className} {...commonProps}>
            <span className={styles.dot} style={{ background: MARKET_COLORS[key] }} aria-hidden />
            <span className={styles.label}>{MARKETS[key].label}</span>
            {status && status !== "idle" ? (
              <span className={`${styles.statusDot} ${statusClass[status]}`} role="img" aria-label={statusLabel[status]} />
            ) : null}
            <span className={styles.tooltip} role="tooltip">{sources[key]}</span>
          </Element>
        );
      })}
    </div>
  );
}
