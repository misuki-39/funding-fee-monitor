import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { MARKETS, MARKET_KEYS } from "../config/markets.js";
import { useDisabledExchanges } from "../exchanges/ExchangePreferencesContext.js";
import type { MarketKey } from "../types/market.js";
import styles from "./SettingsMenu.module.css";

const ALL_MARKETS = Object.values(MARKETS);

export function SettingsMenu() {
  const [open, setOpen] = useState(false);
  const { disabled, toggle } = useDisabledExchanges();

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        setOpen(false);
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        className={styles.trigger}
        aria-label="Settings"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <GearIcon />
      </button>
      {open
        ? createPortal(
            <SettingsModal disabled={disabled} toggle={toggle} onClose={() => setOpen(false)} />,
            document.body
          )
        : null}
    </>
  );
}

interface SettingsModalProps {
  disabled: ReadonlySet<MarketKey>;
  toggle: (market: MarketKey) => void;
  onClose: () => void;
}

function SettingsModal({ disabled, toggle, onClose }: SettingsModalProps) {
  const onlyOneEnabled = MARKET_KEYS.length - disabled.size === 1;

  return (
    <div className={styles.backdrop} role="presentation" onClick={onClose}>
      <div
        className={`panel ${styles.dialog}`}
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        onClick={(event) => event.stopPropagation()}
      >
        <header className={styles.header}>
          <h2 className={styles.title}>Visible exchanges</h2>
          <button type="button" className={styles.close} aria-label="Close" onClick={onClose}>×</button>
        </header>
        <ul className={styles.list}>
          {ALL_MARKETS.map((market) => {
            const isDisabled = disabled.has(market.key);
            const lockToggle = !isDisabled && onlyOneEnabled;
            return (
              <li key={market.key}>
                <label className={`${styles.option} ${lockToggle ? styles.locked : ""}`}>
                  <input
                    type="checkbox"
                    checked={!isDisabled}
                    disabled={lockToggle}
                    onChange={() => toggle(market.key)}
                  />
                  <span className={styles.label}>{market.label}</span>
                </label>
              </li>
            );
          })}
        </ul>
        <p className={styles.helperText}>Keep at least one exchange enabled.</p>
      </div>
    </div>
  );
}

function GearIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}
