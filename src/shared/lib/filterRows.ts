import type { FundingRow, SettlementFilter } from "../types/market.js";

export function filterRows(rows: FundingRow[], settlementFilter: SettlementFilter, nowMs = Date.now()): FundingRow[] {
  if (settlementFilter === "all") {
    return rows;
  }

  const maxHours = settlementFilter === "1h" ? 1 : 4;
  const maxMs = maxHours * 3600000;

  return rows.filter((row) => {
    const deltaMs = row.settlementTimeMs - nowMs;
    return deltaMs > 0 && deltaMs <= maxMs;
  });
}
