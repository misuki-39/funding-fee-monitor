import { useEffect, useState } from "react";
import { MARKETS, PAGE_SIZE } from "../../shared/config/markets.js";
import { filterRows } from "../../shared/lib/filterRows.js";
import { formatLastUpdated } from "../../shared/lib/formatters.js";
import { sortRows } from "../../shared/lib/sortRows.js";
import type { MarketKey, SettlementFilter, SortDirection } from "../../shared/types/market.js";
import { Button } from "../../shared/ui/Button.js";
import { MetaPill } from "../../shared/ui/MetaPill.js";
import { StatusBanner } from "../../shared/ui/StatusBanner.js";
import { useFundingRatesQuery } from "./api.js";
import { FundingRatesTable } from "./components/FundingRatesTable.js";
import { MarketTabs } from "./components/MarketTabs.js";
import { SettlementFilter as SettlementFilterControl } from "./components/SettlementFilter.js";
import { persistOverviewMarket, readOverviewMarket } from "./lib/marketPreference.js";
import styles from "./OverviewPage.module.css";

export function OverviewPage() {
  const [market, setMarket] = useState<MarketKey>(() => readOverviewMarket());
  const [settlementFilter, setSettlementFilter] = useState<SettlementFilter>("all");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const query = useFundingRatesQuery(market);

  const handleSelectMarket = (next: MarketKey) => {
    setMarket(next);
    persistOverviewMarket(next);
  };
  const marketConfig = MARKETS[market];
  const rows = query.data?.rows ?? [];
  const visibleRows = sortRows(filterRows(rows, settlementFilter), sortDirection).slice(0, PAGE_SIZE);

  useEffect(() => {
    document.title = `${marketConfig.title} Monitor`;
  }, [marketConfig.title]);

  const statusMessage = query.isPending
    ? `Loading ${marketConfig.label} funding rates...`
    : query.isError
      ? `${marketConfig.label} load failed.`
      : `Loaded ${rows.length} ${marketConfig.label} rows, showing ${visibleRows.length}.`;

  return (
    <main className="app-shell">
      <section className={`panel ${styles.hero}`}>
        <div>
          <p className="eyebrow">Perpetual Funding Dashboard</p>
          <h1 className="title">Funding Rate Monitor</h1>
          <p className="description">
            Compare live funding rates across OKX, Binance, Gate.io, Bitget, Bybit, and GRVT. Filter near-term
            settlements and drill into individual contracts for cross-exchange detail.
          </p>
        </div>
        <div className={styles.controls}>
          <MarketTabs currentMarket={market} disabled={query.isFetching} onSelect={handleSelectMarket} />
          <Button disabled={query.isFetching} onClick={() => void query.refetch()}>
            {query.isFetching ? "Refreshing..." : "Refresh"}
          </Button>
        </div>
      </section>

      <section className={styles.meta}>
        <MetaPill>Exchange: {marketConfig.label}</MetaPill>
        <MetaPill>{formatLastUpdated(query.data?.fetchedAt ?? null)}</MetaPill>
        <MetaPill>Rows: {visibleRows.length} / {rows.length}</MetaPill>
      </section>

      <section className={styles.filters}>
        <SettlementFilterControl
          value={settlementFilter}
          disabled={query.isFetching}
          onChange={setSettlementFilter}
        />
      </section>

      <section className={styles.statusBlock}>
        <StatusBanner>{statusMessage}</StatusBanner>
        {query.isError ? <StatusBanner tone="error">{query.error.message}</StatusBanner> : null}
      </section>

      <FundingRatesTable
        market={market}
        rows={visibleRows}
        sortDirection={sortDirection}
        onToggleSort={() => setSortDirection((current) => current === "asc" ? "desc" : "asc")}
      />

      <footer className={styles.footer}>
        Source: <code>{query.data?.sourceUrl ?? marketConfig.sourceUrl}</code>
      </footer>
    </main>
  );
}
