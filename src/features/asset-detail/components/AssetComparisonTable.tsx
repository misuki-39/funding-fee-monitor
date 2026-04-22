import { MARKETS } from "../../../shared/config/markets.js";
import { formatAnnualizedRate, formatPrice, parseCycleHours, formatRate } from "../../../shared/lib/formatters.js";
import type { AssetDetailRow } from "../../../shared/types/market.js";
import styles from "./AssetComparisonTable.module.css";

interface AssetComparisonTableProps {
  rows: AssetDetailRow[];
}

export function AssetComparisonTable({ rows }: AssetComparisonTableProps) {
  return (
    <div className={styles.shell}>
      <table className={styles.table}>
        <thead className={styles.head}>
          <tr>
            <th className={styles.header} scope="col">Exchange</th>
            <th className={`${styles.header} ${styles.numericHeader}`} scope="col">Funding Rate</th>
            <th className={`${styles.header} ${styles.centerHeader}`} scope="col">Hours</th>
            <th className={`${styles.header} ${styles.numericHeader}`} scope="col">Annualized</th>
            <th className={`${styles.header} ${styles.numericHeader}`} scope="col">Mark Price</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td className="empty-state" colSpan={5}>No exchange data returned.</td>
            </tr>
          ) : (
            rows.map((row) => {
              const fundingRateText = row.available && row.fundingRate !== null ? formatRate(row.fundingRate) : "--";
              const hoursText = row.available && row.cycleLabel !== null ? `${parseCycleHours(row.cycleLabel)}h` : "--";
              const annualizedRateText =
                row.available && row.fundingRate !== null && row.cycleLabel !== null
                  ? formatAnnualizedRate(row.fundingRate, row.cycleLabel)
                  : "--";
              const markPriceText = row.available && row.markPrice !== null ? formatPrice(row.markPrice) : "--";
              const detailState = row.available ? row.symbol : "unavailable";
              const annualizedTone = row.available && row.fundingRate !== null && row.fundingRate >= 0 ? "positive" : "negative";

              return (
                <tr key={`${row.market}-${row.symbol}`} className={row.available ? styles.row : styles.unavailableRow}>
                  <td className={styles.cell}>
                    <div className={styles.exchange}>{MARKETS[row.market].label}</div>
                    <div className={styles.symbol}>{detailState}</div>
                  </td>
                  <td className={`${styles.cell} ${styles.numericCell} number-cell`}>{fundingRateText}</td>
                  <td className={`${styles.cell} ${styles.centerCell}`}>{hoursText}</td>
                  <td className={`${styles.cell} ${styles.numericCell} number-cell`}>
                    {annualizedRateText === "--" ? annualizedRateText : <span className={annualizedTone}>{annualizedRateText}</span>}
                  </td>
                  <td className={`${styles.cell} ${styles.numericCell} number-cell`}>{markPriceText}</td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
