import type { UseQueryResult } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { ASSET_HISTORY_SOURCES, MARKETS, MARKET_COLORS } from "../../../shared/config/markets.js";
import { formatAbsoluteTime, formatPrice, formatRate } from "../../../shared/lib/formatters.js";
import type { AssetFundingHistoryMarketResponse } from "../../../shared/types/api.js";
import type { AssetFundingHistoryRow, MarketKey } from "../../../shared/types/market.js";
import { Button } from "../../../shared/ui/Button.js";
import { SourceChips, type SourceChipStatus } from "../../../shared/ui/SourceChips.js";
import { StatusBanner } from "../../../shared/ui/StatusBanner.js";
import { useAssetHistoryQueries } from "../api.js";
import {
  buildFundingHistoryChartData,
  buildPairwiseComparisonChartData,
  type PairwiseComparisonLine
} from "../lib/historyCharts.js";
import {
  HISTORY_MARKET_ORDER,
  persistBaseHistoryMarkets,
  pickInitialHistoryMarkets,
  sortHistoryMarkets
} from "../lib/historyPreferences.js";
import styles from "./AssetHistorySection.module.css";

const pairColors = ["#2563eb", "#d946ef", "#ea580c", "#0d9488", "#7c3aed", "#dc2626"];

function getPairColor(index: number): string {
  return pairColors[index % pairColors.length];
}

interface AssetHistorySectionProps {
  base: string;
  availableMarkets: MarketKey[];
}

interface TooltipPayloadItem {
  dataKey?: string;
  value?: number | null;
  color?: string;
}

function formatTimeTick(timeMs: number) {
  return new Date(timeMs).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric"
  });
}

function formatLineLabel(dataKey: string, lines: PairwiseComparisonLine[]) {
  if (dataKey.startsWith("funding:")) {
    const market = dataKey.slice("funding:".length) as MarketKey;
    return `${MARKETS[market].label} Funding`;
  }

  if (dataKey.startsWith("price:")) {
    const market = dataKey.slice("price:".length) as MarketKey;
    return `${MARKETS[market].label} Price`;
  }

  if (dataKey.startsWith("spread:")) {
    const parts = dataKey.slice("spread:".length).split(":") as MarketKey[];
    return `${MARKETS[parts[0]].label}/${MARKETS[parts[1]].label} Price Spread`;
  }

  const line = lines.find((entry) => entry.key === dataKey);

  if (!line) {
    return dataKey;
  }

  return `${MARKETS[line.left].label} - ${MARKETS[line.right].label} Cum. Funding`;
}

function ChartTooltip({
  active,
  payload,
  label,
  lines = [],
  formatValue = (value) => formatRate(value)
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: number;
  lines?: PairwiseComparisonLine[];
  formatValue?: (value: number, dataKey: string) => string;
}) {
  if (!active || !payload?.length || label == null) {
    return null;
  }

  const items = payload.filter((item) => item.dataKey && item.value != null);

  if (items.length === 0) {
    return null;
  }

  return (
    <div className={styles.tooltip}>
      <strong>{formatAbsoluteTime(label)}</strong>
      {items.map((item) => {
        const dataKey = item.dataKey ?? "";

        return (
          <div key={dataKey} className={styles.tooltipRow}>
            <span className={styles.tooltipLabel} style={{ color: item.color }}>{formatLineLabel(dataKey, lines)}</span>
            <span>{formatValue(item.value ?? 0, dataKey)}</span>
          </div>
        );
      })}
    </div>
  );
}

function trimRows(rows: AssetFundingHistoryRow[], days: number, fetchedDays: number): AssetFundingHistoryRow[] {
  if (days >= fetchedDays) return rows;
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return rows.map((row) => ({
    ...row,
    points: row.points.filter((p) => p.fundingTimeMs >= cutoff),
    pricePoints: row.pricePoints.filter((p) => p.timeMs >= cutoff)
  }));
}

type HistoryQuery = UseQueryResult<AssetFundingHistoryMarketResponse, Error>;

function getMarketStatus(query: HistoryQuery | undefined): SourceChipStatus {
  if (!query) return "idle";
  if (query.isFetching) return "loading";
  if (query.isError) return "failed";
  if (query.data) return "ready";
  return "idle";
}

export function AssetHistorySection({ base, availableMarkets }: AssetHistorySectionProps) {
  const availableKey = [...availableMarkets].sort().join(",");

  const [draftDays, setDraftDays] = useState("7");
  const [days, setDays] = useState(7);
  const [fetchedDays, setFetchedDays] = useState(7);
  const [selectedMarkets, setSelectedMarkets] = useState<MarketKey[]>(() => pickInitialHistoryMarkets(base, availableMarkets));
  const [selectedPairKeys, setSelectedPairKeys] = useState<Set<string>>(new Set());
  const [prevBase, setPrevBase] = useState(base);
  const [prevAvailableKey, setPrevAvailableKey] = useState(availableKey);

  if (prevBase !== base) {
    setPrevBase(base);
    setPrevAvailableKey(availableKey);
    setSelectedMarkets(pickInitialHistoryMarkets(base, availableMarkets));
    setSelectedPairKeys(new Set());
  } else if (prevAvailableKey !== availableKey) {
    setPrevAvailableKey(availableKey);
    const availableSet = new Set(availableMarkets);
    const pruned = selectedMarkets.filter((market) => availableSet.has(market));
    setSelectedMarkets(pruned.length > 0 ? pruned : pickInitialHistoryMarkets(base, availableMarkets));
  }

  const visibleMarkets = useMemo(
    () => HISTORY_MARKET_ORDER.filter((market) => availableMarkets.includes(market)),
    [availableMarkets]
  );
  const selectedMarketSet = useMemo(() => new Set(selectedMarkets), [selectedMarkets]);

  const queries = useAssetHistoryQueries(base, fetchedDays, selectedMarkets);

  const queryByMarket = useMemo(
    () => new Map(selectedMarkets.map((market, index) => [market, queries[index]])),
    [selectedMarkets, queries]
  );

  const marketStatuses = useMemo<Partial<Record<MarketKey, SourceChipStatus>>>(() => {
    const map: Partial<Record<MarketKey, SourceChipStatus>> = {};
    for (const market of visibleMarkets) {
      const query = queryByMarket.get(market);
      if (query) {
        map[market] = getMarketStatus(query);
      }
    }
    return map;
  }, [visibleMarkets, queryByMarket]);
  const loadedRows = useMemo(
    () => queries.flatMap((query) => (query.data ? [query.data.row] : [])),
    [queries]
  );
  const errorMessages = selectedMarkets.flatMap((market) => {
    const query = queryByMarket.get(market);
    if (!query?.isError) return [];
    return [`${MARKETS[market].label}: ${query.error.message}`];
  });
  const isHistoryPending = selectedMarkets.length > 0 && queries.some((query) => query.isPending && !query.data);
  const isHistoryFetching = queries.some((query) => query.isFetching);

  const trimmedRows = useMemo(
    () => trimRows(loadedRows, days, fetchedDays),
    [days, fetchedDays, loadedRows]
  );

  const parsedDraftDays = Number(draftDays);
  const isValidDraftDays = Number.isInteger(parsedDraftDays) && parsedDraftDays >= 1 && parsedDraftDays <= 14;
  const fundingChartData = useMemo(
    () => buildFundingHistoryChartData(trimmedRows, selectedMarkets),
    [selectedMarkets, trimmedRows]
  );
  const pairwiseChart = useMemo(
    () => buildPairwiseComparisonChartData(trimmedRows, selectedMarkets),
    [selectedMarkets, trimmedRows]
  );

  const timeDomain = useMemo<[number, number] | undefined>(() => {
    if (fundingChartData.length === 0) return undefined;
    const first = fundingChartData[0].timeMs;
    const last = fundingChartData[fundingChartData.length - 1].timeMs;
    return [first, last];
  }, [fundingChartData]);

  const availablePairKeys = useMemo(
    () => new Set(pairwiseChart.lines.map((line) => line.key)),
    [pairwiseChart.lines]
  );

  const filteredPairKeys = useMemo(() => {
    const filtered = new Set([...selectedPairKeys].filter((key) => availablePairKeys.has(key)));
    if (filtered.size === 0 && availablePairKeys.size > 0) return availablePairKeys;
    return filtered;
  }, [availablePairKeys, selectedPairKeys]);

  const visiblePairLines = useMemo(
    () => pairwiseChart.lines.filter((l) => filteredPairKeys.has(l.key)),
    [pairwiseChart.lines, filteredPairKeys]
  );

  function togglePair(key: string) {
    const next = new Set(filteredPairKeys);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    setSelectedPairKeys(next);
  }

  function toggleMarket(market: MarketKey) {
    const next = sortHistoryMarkets(
      selectedMarkets.includes(market)
        ? selectedMarkets.filter((item) => item !== market)
        : [...selectedMarkets, market]
    );
    setSelectedMarkets(next);
    persistBaseHistoryMarkets(base, next);
  }

  return (
    <section className={`panel ${styles.panel}`}>
      <div className={styles.head}>
        <div>
          <h2 className={styles.title}>Funding History and Pairwise Cumulative Spread</h2>
        </div>
        <SourceChips
          sources={ASSET_HISTORY_SOURCES}
          marketKeys={visibleMarkets}
          selectedKeys={selectedMarketSet}
          onToggle={toggleMarket}
          statuses={marketStatuses}
        />
      </div>

      <div className={styles.controls}>
        <label className={styles.daysControl}>
          <span className={styles.controlLabel}>Lookback Days</span>
          <div className={styles.daysRow}>
            <input
              className={styles.daysInput}
              type="number"
              min={1}
              max={14}
              step={1}
              value={draftDays}
              onChange={(event) => setDraftDays(event.target.value)}
            />
            <Button
              disabled={!isValidDraftDays || isHistoryFetching || parsedDraftDays === days}
              onClick={() => {
                setDays(parsedDraftDays);
                if (parsedDraftDays > fetchedDays) {
                  setFetchedDays(parsedDraftDays);
                }
              }}
            >
              {isHistoryFetching ? "Applying..." : "Apply"}
            </Button>
          </div>
        </label>

      </div>

      <div className={styles.statusBlock}>
        {!isValidDraftDays ? <StatusBanner tone="error">Lookback days must be an integer between 1 and 14.</StatusBanner> : null}
        {isHistoryPending ? <StatusBanner>Loading selected exchange history...</StatusBanner> : null}
        {errorMessages.map((message) => <StatusBanner key={message} tone="error">{message}</StatusBanner>)}
      </div>

      <div className={styles.chartGrid}>
        <section className={styles.chartCard}>
          <div className={styles.chartHead}>
            <h3 className={styles.chartTitle}>Funding + Price History</h3>
            <p className={styles.chartDescription}>Each selected exchange shows raw funding rate and its own price line.</p>
          </div>
          {selectedMarkets.length === 0 ? (
            <div className="empty-state">Select at least one exchange to load history.</div>
          ) : fundingChartData.length === 0 ? (
            <div className="empty-state">No history returned for the selected exchanges.</div>
          ) : (
            <div className={styles.chartFrame}>
              <ResponsiveContainer width="100%" height={340}>
                <LineChart data={fundingChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(54, 41, 22, 0.12)" />
                  <XAxis dataKey="timeMs" type="number" domain={timeDomain} tickFormatter={formatTimeTick} minTickGap={32} />
                  <YAxis yAxisId="funding" tickFormatter={(value: number) => formatRate(value)} width={84} />
                  <YAxis yAxisId="price" orientation="right" tickFormatter={(value: number) => formatPrice(value)} width={84} />
                  <Tooltip content={<ChartTooltip formatValue={(value, dataKey) => dataKey.startsWith("price:") ? formatPrice(value) : formatRate(value)} />} />
                  <Legend formatter={(value) => formatLineLabel(String(value), [])} />
                  {selectedMarkets.map((market) => (
                    <Line
                      key={`funding:${market}`}
                      yAxisId="funding"
                      type="linear"
                      dataKey={`funding:${market}`}
                      name={`funding:${market}`}
                      stroke={MARKET_COLORS[market]}
                      strokeWidth={2}
                      dot={false}
                      connectNulls={false}
                      isAnimationActive={false}
                    />
                  ))}
                  {selectedMarkets.map((market) => (
                    <Line
                      key={`price:${market}`}
                      yAxisId="price"
                      type="monotone"
                      dataKey={`price:${market}`}
                      name={`price:${market}`}
                      stroke={MARKET_COLORS[market]}
                      strokeDasharray="6 4"
                      strokeOpacity={0.45}
                      strokeWidth={2}
                      dot={false}
                      connectNulls={false}
                      isAnimationActive={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        <section className={styles.chartCard}>
          <div className={styles.chartHead}>
            <h3 className={styles.chartTitle}>Pairwise Cumulative Spread</h3>
            <p className={styles.chartDescription}>Each exchange accumulates its own raw funding events first, then pairs are compared by cumulative difference.</p>
          </div>
          {pairwiseChart.lines.length > 0 && (
            <div className={styles.marketControls}>
              <span className={styles.controlLabel}>Pairs</span>
              <div className={styles.marketList}>
                {pairwiseChart.lines.map((line) => (
                  <label key={line.key} className={styles.marketOption}>
                    <input
                      type="checkbox"
                      checked={filteredPairKeys.has(line.key)}
                      onChange={() => togglePair(line.key)}
                    />
                    <span>{MARKETS[line.left].label} / {MARKETS[line.right].label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          {selectedMarkets.length < 2 ? (
            <div className="empty-state">Select at least two exchanges to compare cumulative spreads.</div>
          ) : pairwiseChart.data.length === 0 ? (
            <div className="empty-state">No pairwise comparison data returned for the selected exchanges.</div>
          ) : (
            <div className={styles.chartFrame}>
              <ResponsiveContainer width="100%" height={340}>
                <LineChart data={pairwiseChart.data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(54, 41, 22, 0.12)" />
                  <XAxis dataKey="timeMs" type="number" domain={timeDomain} tickFormatter={formatTimeTick} minTickGap={32} />
                  <YAxis yAxisId="funding" tickFormatter={(value: number) => formatRate(value)} width={84} />
                  <YAxis yAxisId="spread" orientation="right" tickFormatter={(value: number) => formatRate(value)} width={84} />
                  <Tooltip content={<ChartTooltip lines={visiblePairLines} />} />
                  <Legend formatter={(value) => formatLineLabel(String(value), visiblePairLines)} />
                  {visiblePairLines.map((line) => {
                    const color = getPairColor(pairwiseChart.lines.indexOf(line));
                    return (
                      <Line
                        key={line.key}
                        yAxisId="funding"
                        type="stepAfter"
                        dataKey={line.key}
                        name={line.key}
                        stroke={color}
                        strokeWidth={2}
                        dot={false}
                        isAnimationActive={false}
                      />
                    );
                  })}
                  {visiblePairLines.map((line) => {
                    const color = getPairColor(pairwiseChart.lines.indexOf(line));
                    return (
                      <Line
                        key={`spread:${line.left}:${line.right}`}
                        yAxisId="spread"
                        type="linear"
                        dataKey={`spread:${line.left}:${line.right}`}
                        name={`spread:${line.left}:${line.right}`}
                        stroke={color}
                        strokeDasharray="6 4"
                        strokeOpacity={0.5}
                        strokeWidth={2}
                        dot={false}
                        connectNulls={false}
                        isAnimationActive={false}
                      />
                    );
                  })}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
