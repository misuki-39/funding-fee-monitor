import { createColumnHelper, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { Link } from "react-router-dom";
import { extractBaseSymbol } from "../../../shared/lib/assets.js";
import { formatAbsoluteTime, formatRate, formatTimeToSettlement } from "../../../shared/lib/formatters.js";
import type { FundingRow, MarketKey, SortDirection } from "../../../shared/types/market.js";
import styles from "./FundingRatesTable.module.css";

const columnHelper = createColumnHelper<FundingRow>();

interface FundingRatesTableProps {
  market: MarketKey;
  rows: FundingRow[];
  sortDirection: SortDirection;
  onToggleSort: () => void;
}

export function FundingRatesTable({ market, rows, sortDirection, onToggleSort }: FundingRatesTableProps) {
  const columns = [
    columnHelper.accessor("symbol", {
      header: "Symbol",
      cell: ({ row }) => {
        const base = extractBaseSymbol(market, row.original.symbol);
        return (
          <Link className={styles.symbolLink} to={`/assets/${encodeURIComponent(base)}`}>
            {row.original.symbol}
          </Link>
        );
      }
    }),
    columnHelper.accessor("fundingRate", {
      header: () => (
        <button className={styles.sortButton} type="button" onClick={onToggleSort}>
          Funding Rate
          <span className={styles.sortIndicator}>{sortDirection === "asc" ? "▲" : "▼"}</span>
        </button>
      ),
      cell: ({ getValue }) => {
        const value = getValue();
        const tone = value >= 0 ? "positive" : "negative";

        return <span className={`number-cell ${tone}`}>{formatRate(value)}</span>;
      }
    }),
    columnHelper.accessor("cycleLabel", {
      header: "Cycle",
      cell: ({ getValue }) => <span className={styles.cycle}>{getValue()}</span>
    }),
    columnHelper.accessor("settlementTimeMs", {
      header: "Settlement In",
      cell: ({ getValue }) => (
        <span className="number-cell" title={formatAbsoluteTime(getValue())}>
          {formatTimeToSettlement(getValue())}
        </span>
      )
    })
  ];

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel()
  });

  return (
    <div className={styles.shell}>
      <table className={styles.table}>
        <thead className={styles.head}>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th key={header.id} className={styles.header} scope="col">
                  {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.length === 0 ? (
            <tr>
              <td className="empty-state" colSpan={4}>No data returned.</td>
            </tr>
          ) : (
            table.getRowModel().rows.map((row) => (
              <tr key={row.id} className={styles.row}>
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className={styles.cell}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
