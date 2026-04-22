import { useEffect, useMemo, useState } from "react";
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
import { MARKETS } from "../../../shared/config/markets.js";
import { formatAbsoluteTime, formatPrice, formatRate } from "../../../shared/lib/formatters.js";
import type { AssetFundingHistoryRow, MarketKey } from "../../../shared/types/market.js";
import { Button } from "../../../shared/ui/Button.js";
import { MetaPill } from "../../../shared/ui/MetaPill.js";
import { StatusBanner } from "../../../shared/ui/StatusBanner.js";
import { useAssetHistoryQuery } from "../api.js";
import {
  buildFundingHistoryChartData,
  buildPairwiseComparisonChartData,
  getDefaultHistoryMarkets,
  type PairwiseComparisonLine
} from "../lib/historyCharts.js";
import styles from "./AssetHistorySection.module.css";

const marketColors: Record<MarketKey, string> = {
  okx: "#9d3c17",
  binance: "#8c6a00",
  gate: "#11643c"
};

const pairColors = ["#2563eb", "#d946ef", "#ea580c", "#0d9488", "#7c3aed", "#dc2626"];

function getPairColor(index: number): string {
  return pairColors[index % pairColors.length];
}

function sameMarkets(left: MarketKey[], right: MarketKey[]) {
  return left.length === right.length && left.every((market, index) => market === right[index]);
}

interface AssetHistorySectionProps {
  base: string;
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

export function AssetHistorySection({ base }: AssetHistorySectionProps) {
  const [draftDays, setDraftDays] = useState("7");
  const [days, setDays] = useState(7);
  const [fetchedDays, setFetchedDays] = useState(7);
  const [selectedMarkets, setSelectedMarkets] = useState<MarketKey[]>([]);
  const [selectedPairKeys, setSelectedPairKeys] = useState<Set<string>>(new Set());
  const query = useAssetHistoryQuery(base, fetchedDays);

  const trimmedRows = useMemo(
    () => trimRows(query.data?.rows ?? [], days, fetchedDays),
    [query.data?.rows, days, fetchedDays]
  );
  const availableMarkets = useMemo(() => getDefaultHistoryMarkets(trimmedRows), [trimmedRows]);

  useEffect(() => {
    if (query.isPending) return;

    setSelectedMarkets((current) => {
      if (current.length === 0) {
        return availableMarkets;
      }

      const filtered = current.filter((market) => availableMarkets.includes(market));
      return sameMarkets(current, filtered) ? current : filtered.length > 0 ? filtered : availableMarkets;
    });
  }, [availableMarkets, query.isPending]);

  const parsedDraftDays = Number(draftDays);
  const isValidDraftDays = Number.isInteger(parsedDraftDays) && parsedDraftDays >= 1 && parsedDraftDays <= 14;
  const fundingChartData = useMemo(
    () => buildFundingHistoryChartData(trimmedRows, selectedMarkets),
    [trimmedRows, selectedMarkets]
  );
  const pairwiseChart = useMemo(
    () => buildPairwiseComparisonChartData(trimmedRows, selectedMarkets),
    [trimmedRows, selectedMarkets]
  );

  const timeDomain = useMemo<[number, number] | undefined>(() => {
    if (fundingChartData.length === 0) return undefined;
    const first = fundingChartData[0].timeMs as number;
    const last = fundingChartData[fundingChartData.length - 1].timeMs as number;
    return [first, last];
  }, [fundingChartData]);

  // Stable string key for pair lines to avoid infinite effect loops from new array refs
  const pairLineKeys = useMemo(
    () => pairwiseChart.lines.map((l) => l.key).join(","),
    [pairwiseChart.lines]
  );

  // Auto-select new pairs, keep existing selections for pairs that still exist
  useEffect(() => {
    const availableKeys = new Set(pairLineKeys.split(",").filter(Boolean));
    setSelectedPairKeys((current) => {
      const filtered = new Set([...current].filter((k) => availableKeys.has(k)));
      if (filtered.size === 0 && availableKeys.size > 0) return availableKeys;
      return filtered.size === current.size && [...filtered].every((k) => current.has(k)) ? current : filtered;
    });
  }, [pairLineKeys]);

  const visiblePairLines = useMemo(
    () => pairwiseChart.lines.filter((l) => selectedPairKeys.has(l.key)),
    [pairwiseChart.lines, selectedPairKeys]
  );

  function togglePair(key: string) {
    setSelectedPairKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  function toggleMarket(market: MarketKey) {
    setSelectedMarkets((current) => current.includes(market)
      ? current.filter((item) => item !== market)
      : [...current, market]);
  }

  return (
    <section className={`panel ${styles.panel}`}>
      <div className={styles.head}>
        <div>
          <h2 className={styles.title}>Funding History and Pairwise Cumulative Spread</h2>
        </div>
        <MetaPill>{query.data?.sourceLabel ?? "History sources pending"}</MetaPill>
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
              disabled={!isValidDraftDays || query.isFetching || parsedDraftDays === days}
              onClick={() => {
                setDays(parsedDraftDays);
                if (parsedDraftDays > fetchedDays) {
                  setFetchedDays(parsedDraftDays);
                }
              }}
            >
              {query.isFetching ? "Applying..." : "Apply"}
            </Button>
          </div>
        </label>

        <div className={styles.marketControls}>
          <span className={styles.controlLabel}>Exchanges</span>
          <div className={styles.marketList}>
            {availableMarkets.map((market) => (
              <label key={market} className={styles.marketOption}>
                <input
                  type="checkbox"
                  checked={selectedMarkets.includes(market)}
                  onChange={() => toggleMarket(market)}
                />
                <span>{MARKETS[market].label}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className={styles.statusBlock}>
        {!isValidDraftDays ? <StatusBanner tone="error">Lookback days must be an integer between 1 and 14.</StatusBanner> : null}
        {query.isError ? <StatusBanner tone="error">{query.error.message}</StatusBanner> : null}
      </div>

      <div className={styles.chartGrid}>
        <section className={styles.chartCard}>
          <div className={styles.chartHead}>
            <h3 className={styles.chartTitle}>Funding + Price History</h3>
            <p className={styles.chartDescription}>Each selected exchange shows raw funding rate and its own price line.</p>
          </div>
          {fundingChartData.length === 0 ? (
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
                      stroke={marketColors[market]}
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
                      stroke={marketColors[market]}
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
                      checked={selectedPairKeys.has(line.key)}
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
