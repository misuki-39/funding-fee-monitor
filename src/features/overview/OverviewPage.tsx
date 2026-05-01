import { useCallback, useEffect, useState } from "react";
import { MARKETS, PAGE_SIZE } from "../../shared/config/markets.js";
import { useEnabledMarketKeys } from "../../shared/exchanges/ExchangePreferencesContext.js";
import { filterRows } from "../../shared/lib/filterRows.js";
import { formatLastUpdated } from "../../shared/lib/formatters.js";
import { sortRows } from "../../shared/lib/sortRows.js";
import type { MarketKey, SettlementFilter, SortDirection } from "../../shared/types/market.js";
import { AppHeader } from "../../shared/ui/AppHeader.js";
import { Button } from "../../shared/ui/Button.js";
import { SettingsMenu } from "../../shared/ui/SettingsMenu.js";
import { StatusBanner } from "../../shared/ui/StatusBanner.js";
import { useFundingRatesQuery } from "./api.js";
import { FundingRatesTable } from "./components/FundingRatesTable.js";
import { MarketTabs } from "./components/MarketTabs.js";
import { SettlementFilter as SettlementFilterControl } from "./components/SettlementFilter.js";
import { persistOverviewMarket, readOverviewMarket } from "./lib/marketPreference.js";
import { useKeyboardShortcuts } from "./lib/useKeyboardShortcuts.js";
import styles from "./OverviewPage.module.css";

export function OverviewPage() {
  const [market, setMarket] = useState<MarketKey>(() => readOverviewMarket());
  const [settlementFilter, setSettlementFilter] = useState<SettlementFilter>("all");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const enabledKeys = useEnabledMarketKeys();
  const query = useFundingRatesQuery(market);

  const handleSelectMarket = useCallback((next: MarketKey) => {
    setMarket(next);
    persistOverviewMarket(next);
  }, []);

  useEffect(() => {
    if (!enabledKeys.includes(market)) {
      handleSelectMarket(enabledKeys[0]);
    }
  }, [enabledKeys, market, handleSelectMarket]);

  const marketConfig = MARKETS[market];
  const rows = query.data?.rows ?? [];
  const visibleRows = sortRows(filterRows(rows, settlementFilter), sortDirection).slice(0, PAGE_SIZE);

  useEffect(() => {
    document.title = `${marketConfig.title} Monitor`;
  }, [marketConfig.title]);

  useKeyboardShortcuts({
    enabledKeys,
    onSelectMarket: handleSelectMarket,
    onRefresh: () => void query.refetch()
  });

  const statusMessage = query.isPending
    ? `Loading ${marketConfig.label} funding rates...`
    : query.isError
      ? `${marketConfig.label} load failed.`
      : null;

  return (
    <>
      <AppHeader
        left={<span className={styles.brand}>Funding Rates</span>}
        center={
          <MarketTabs
            currentMarket={market}
            disabled={query.isFetching}
            size="compact"
            onSelect={handleSelectMarket}
          />
        }
        right={
          <>
            <span className={styles.lastUpdated}>{formatLastUpdated(query.data?.fetchedAt ?? null)}</span>
            <Button disabled={query.isFetching} onClick={() => void query.refetch()} className={styles.refreshButton}>
              {query.isFetching ? "..." : "Refresh"}
            </Button>
            <SettingsMenu />
          </>
        }
      />
      <main className="app-shell">
        <section className={styles.filters}>
          <SettlementFilterControl
            value={settlementFilter}
            disabled={query.isFetching}
            onChange={setSettlementFilter}
          />
        </section>

        {statusMessage || query.isError ? (
          <section className={styles.statusBlock}>
            {statusMessage ? <StatusBanner>{statusMessage}</StatusBanner> : null}
            {query.isError ? <StatusBanner tone="error">{query.error.message}</StatusBanner> : null}
          </section>
        ) : null}

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
    </>
  );
}
