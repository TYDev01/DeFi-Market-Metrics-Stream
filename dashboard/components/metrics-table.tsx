"use client";

import { useCallback } from "react";
import { ArrowDownUp, ArrowUp, ArrowDown } from "lucide-react";
import { PriceMetric, MetricField } from "@/lib/types";
import { formatDelta, formatPercent, formatPrice } from "@/lib/utils";

export interface SortState {
  column: MetricField;
  direction: "asc" | "desc";
}

interface MetricsTableProps {
  metrics: PriceMetric[];
  sort: SortState;
  onSortChange: (next: SortState) => void;
}

const HEADERS: Array<{ label: string; field: MetricField; numeric?: boolean }> = [
  { label: "Pair", field: "pairId" },
  { label: "Base", field: "baseToken" },
  { label: "Quote", field: "quoteToken" },
  { label: "Source", field: "source" },
  { label: "Price", field: "price", numeric: true },
  { label: "Δ", field: "priceDelta", numeric: true },
  { label: "Δ %", field: "priceDeltaPercent", numeric: true },
  { label: "Updated", field: "timestamp", numeric: true }
];

export default function MetricsTable({ metrics, sort, onSortChange }: MetricsTableProps) {
  const handleSort = useCallback(
    (field: MetricField) => {
      if (sort.column === field) {
        onSortChange({ column: field, direction: sort.direction === "asc" ? "desc" : "asc" });
      } else {
        onSortChange({ column: field, direction: "desc" });
      }
    },
    [onSortChange, sort]
  );

  const getIcon = (field: MetricField) => {
    if (sort.column !== field) return <ArrowDownUp className="h-4 w-4 text-slate-400" />;
    return sort.direction === "asc" ? (
      <ArrowUp className="h-4 w-4 text-somnia-primary" />
    ) : (
      <ArrowDown className="h-4 w-4 text-somnia-primary" />
    );
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-somnia-card/80 text-slate-100 shadow-soft backdrop-blur-xl">
      <table className="min-w-full">
        <thead className="bg-somnia-muted text-xs font-semibold uppercase tracking-wide text-slate-300">
          <tr>
            {HEADERS.map((header) => (
              <th
                key={header.field}
                className={`px-4 py-3 text-left ${header.numeric ? "text-right" : ""}`}
              >
                <button
                  type="button"
                  onClick={() => handleSort(header.field)}
                  className="flex items-center gap-2 text-left"
                >
                  <span>{header.label}</span>
                  {getIcon(header.field)}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5 text-sm text-slate-200">
          {metrics.map((metric) => {
            const updated = new Date(metric.timestamp * 1000).toLocaleTimeString();
            const changeClass =
              metric.priceDeltaPercent > 0 ? "text-green-300" : metric.priceDeltaPercent < 0 ? "text-rose-300" : "text-slate-200";

            return (
              <tr key={metric.pairId}>
                <td className="px-4 py-3 font-semibold text-white">{metric.pairId}</td>
                <td className="px-4 py-3">{metric.baseToken}</td>
                <td className="px-4 py-3">{metric.quoteToken}</td>
                <td className="px-4 py-3">{metric.source}</td>
                <td className="px-4 py-3 text-right font-medium text-white">
                  {formatPrice(metric.price, metric.quoteToken)}
                </td>
                <td className="px-4 py-3 text-right">{formatDelta(metric.priceDelta, metric.quoteToken)}</td>
                <td className={`px-4 py-3 text-right font-semibold ${changeClass}`}>
                  {formatPercent(metric.priceDeltaPercent)}
                </td>
                <td className="px-4 py-3 text-right text-slate-400">{updated}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
