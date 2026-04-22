import type { FundingRow, SortDirection } from "../types/market.js";

export function sortRows(rows: FundingRow[], sortDirection: SortDirection): FundingRow[] {
  const fundingDirection = sortDirection === "asc" ? 1 : -1;

  return [...rows].sort((left, right) => {
    const fundingDiff = left.fundingRate - right.fundingRate;
    if (fundingDiff !== 0) {
      return fundingDiff * fundingDirection;
    }

    return left.symbol.localeCompare(right.symbol);
  });
}
