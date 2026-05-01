import { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { ASSET_DETAIL_SOURCE_LABEL } from "../../shared/config/markets.js";
import { formatLastUpdated } from "../../shared/lib/formatters.js";
import { AppHeader } from "../../shared/ui/AppHeader.js";
import { MetaPill } from "../../shared/ui/MetaPill.js";
import { StatusBanner } from "../../shared/ui/StatusBanner.js";
import { useAssetDetailQuery } from "./api.js";
import { AssetComparisonTable } from "./components/AssetComparisonTable.js";
import { AssetHistorySection } from "./components/AssetHistorySection.js";
import styles from "./AssetDetailPage.module.css";

export function AssetDetailPage() {
  const params = useParams();
  const base = params.base ?? "";
  const query = useAssetDetailQuery(base);
  const availableMarkets = query.data?.rows.filter((row) => row.available).map((row) => row.market) ?? null;

  useEffect(() => {
    document.title = base ? `${base} Funding Comparison` : "Asset Funding Comparison";
  }, [base]);

  const statusMessage = !base
    ? "Asset load failed."
    : query.isPending
      ? `Loading ${base} across exchanges...`
      : query.isError
        ? `${base} load failed.`
        : null;

  return (
    <>
      <AppHeader
        left={
          <>
            <Link to="/" className={styles.backLink} aria-label="Back to Markets">←</Link>
            <Link to="/" className={styles.brand}>Funding Rates</Link>
            <span className={styles.divider}>/</span>
            <strong className={styles.asset}>{base || "Asset"}</strong>
          </>
        }
        right={<span className={styles.lastUpdated}>{formatLastUpdated(query.data?.fetchedAt ?? null)}</span>}
      />
      <main className="app-shell">
        <section className={`panel ${styles.panel}`}>
          <div className={styles.panelHead}>
            <div>
              <h2 className={styles.panelTitle}>Live Funding Board</h2>
            </div>
            <MetaPill>{query.data?.sourceLabel ?? ASSET_DETAIL_SOURCE_LABEL}</MetaPill>
          </div>

          {statusMessage || !base || query.isError ? (
            <div className={styles.statusBlock}>
              {statusMessage ? <StatusBanner>{statusMessage}</StatusBanner> : null}
              {!base ? <StatusBanner tone="error">Missing asset base.</StatusBanner> : null}
              {query.isError ? <StatusBanner tone="error">{query.error.message}</StatusBanner> : null}
            </div>
          ) : null}

          <AssetComparisonTable rows={query.data?.rows ?? []} />
        </section>

        {base && availableMarkets && availableMarkets.length > 0 ? (
          <AssetHistorySection base={base} availableMarkets={availableMarkets} />
        ) : null}
      </main>
    </>
  );
}
