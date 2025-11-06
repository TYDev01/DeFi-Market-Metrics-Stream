"use client";

import { useCallback } from "react";
import { ArrowDownUp, ArrowUp, ArrowDown } from "lucide-react";
import { DefiMetric, MetricField } from "@/lib/types";
import { formatApr, formatUsd } from "@/lib/utils";

export interface SortState {
  column: MetricField;
  direction: "asc" | "desc";
}

interface MetricsTableProps {
  metrics: DefiMetric[];
  sort: SortState;
  onSortChange: (next: SortState) => void;
}

const HEADERS: Array<{ label: string; field: MetricField; numeric?: boolean }> = [
  { label: "Protocol", field: "protocol" },
  { label: "Network", field: "network" },
  { label: "Pool", field: "poolId" },
  { label: "Base Token", field: "baseToken" },
  { label: "Quote Token", field: "quoteToken" },
  { label: "TVL (USD)", field: "tvlUsd", numeric: true },
  { label: "Volume 24h (USD)", field: "volume24hUsd", numeric: true },
  { label: "Fees 24h (USD)", field: "fees24hUsd", numeric: true },
  { label: "APR (bps)", field: "aprBps", numeric: true }
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
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-soft">
      <table className="min-w-full">
        <thead className="bg-somnia-muted text-xs font-semibold uppercase tracking-wide text-slate-600">
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
        <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
          {metrics.map((metric) => (
            <tr key={`${metric.protocol}-${metric.poolId}`}>
              <td className="px-4 py-3 font-semibold text-slate-900">{metric.protocol}</td>
              <td className="px-4 py-3">{metric.network}</td>
              <td className="px-4 py-3">{metric.poolId}</td>
              <td className="px-4 py-3">{metric.baseToken}</td>
              <td className="px-4 py-3">{metric.quoteToken}</td>
              <td className="px-4 py-3 text-right">{formatUsd(metric.tvlUsd)}</td>
              <td className="px-4 py-3 text-right">{formatUsd(metric.volume24hUsd)}</td>
              <td className="px-4 py-3 text-right">{formatUsd(metric.fees24hUsd)}</td>
              <td className="px-4 py-3 text-right text-somnia-primary">{formatApr(metric.aprBps)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
