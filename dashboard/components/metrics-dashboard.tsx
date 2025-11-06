"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import FilterBar from "./filter-bar";
import MetricsTable, { SortState } from "./metrics-table";
import MetricsCharts from "./metrics-charts";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { DefiMetric, FilterState } from "@/lib/types";
import { formatApr, formatUsd } from "@/lib/utils";

interface MetricsDashboardProps {
  initialMetrics: DefiMetric[];
}

export default function MetricsDashboard({ initialMetrics }: MetricsDashboardProps) {
  const router = useRouter();
  const [filters, setFilters] = useState<FilterState>({
    search: "",
    protocol: "",
    network: "",
    minAprPercent: 0
  });
  const [sort, setSort] = useState<SortState>({ column: "tvlUsd", direction: "desc" });

  const metrics = useMemo(() => initialMetrics, [initialMetrics]);

  const protocols = useMemo(
    () => Array.from(new Set(metrics.map((metric) => metric.protocol))).sort(),
    [metrics]
  );
  const networks = useMemo(
    () => Array.from(new Set(metrics.map((metric) => metric.network))).sort(),
    [metrics]
  );

  const filteredMetrics = useMemo(() => {
    return metrics.filter((metric) => {
      const matchesSearch =
        filters.search.length === 0 ||
        metric.protocol.toLowerCase().includes(filters.search.toLowerCase()) ||
        metric.poolId.toLowerCase().includes(filters.search.toLowerCase()) ||
        metric.baseToken.toLowerCase().includes(filters.search.toLowerCase()) ||
        metric.quoteToken.toLowerCase().includes(filters.search.toLowerCase());

      const matchesProtocol = !filters.protocol || metric.protocol === filters.protocol;
      const matchesNetwork = !filters.network || metric.network === filters.network;
      const meetsApr = Number(metric.aprBps) / 100 >= filters.minAprPercent;

      return matchesSearch && matchesProtocol && matchesNetwork && meetsApr;
    });
  }, [metrics, filters]);

  const sortedMetrics = useMemo(() => {
    const sortable = [...filteredMetrics];
    sortable.sort((a, b) => {
      const field = sort.column;
      const first = a[field];
      const second = b[field];

      if (typeof first === "string" && typeof second === "string") {
        return sort.direction === "asc" ? first.localeCompare(second) : second.localeCompare(first);
      }

      const firstNumber = Number(first);
      const secondNumber = Number(second);
      return sort.direction === "asc" ? firstNumber - secondNumber : secondNumber - firstNumber;
    });

    return sortable;
  }, [filteredMetrics, sort]);

  const totals = useMemo(() => {
    const aggregate = metrics.reduce(
      (acc, metric) => {
        acc.tvl += metric.tvlUsd;
        acc.volume += metric.volume24hUsd;
        acc.fees += metric.fees24hUsd;
        return acc;
      },
      { tvl: 0, volume: 0, fees: 0 }
    );
    const avgApr = metrics.length > 0 ? metrics.reduce((sum, m) => sum + m.aprBps, 0) / metrics.length : 0;

    return { ...aggregate, avgApr };
  }, [metrics]);

  const latestUpdate = useMemo(() => {
    const timestamps = metrics.map((metric) => metric.timestamp);
    return timestamps.length ? new Date(Math.max(...timestamps) * 1000).toLocaleString() : "N/A";
  }, [metrics]);

  const handleRefresh = () => {
    router.refresh();
  };

  const handleSubscribe = () => {
    const url = process.env.NEXT_PUBLIC_TELEGRAM_BOT_URL ?? "https://t.me/somnia_alerts_bot";
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleFilterChange = (next: Partial<FilterState>) => {
    setFilters((prev) => ({ ...prev, ...next }));
  };

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-slate-200 bg-white p-8 text-slate-800 shadow-soft">
        <span className="text-xs uppercase tracking-[0.2em] text-somnia-primary">Somnia Streams</span>
        <h1 className="mt-4 text-3xl font-semibold text-slate-900">
          Real-time DeFi Analytics &amp; Alerts
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-slate-600">
          Powered by Chainlink Data Feeds, Chainlink Automation, and Somnia Data Streams. Monitor protocol
          performance and subscribe for threshold-based alerts.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button onClick={handleSubscribe}>Subscribe For Alerts</Button>
          <Button variant="outline" onClick={handleRefresh}>
            Refresh Dashboard
          </Button>
          <span className="text-xs text-slate-500">Last update: {latestUpdate}</span>
        </div>
      </section>

      <FilterBar
        filters={filters}
        protocols={protocols}
        networks={networks}
        onFilterChange={handleFilterChange}
        onRefresh={handleRefresh}
      />

      <section className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="space-y-3 p-6">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total TVL</span>
            <p className="text-2xl font-semibold text-slate-900">{formatUsd(totals.tvl)}</p>
            <span className="text-xs text-slate-500">Across {metrics.length} pools</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-3 p-6">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">24h Volume</span>
            <p className="text-2xl font-semibold text-slate-900">{formatUsd(totals.volume)}</p>
            <span className="text-xs text-slate-500">Tracked via Somnia stream snapshots</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-3 p-6">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">24h Fees</span>
            <p className="text-2xl font-semibold text-slate-900">{formatUsd(totals.fees)}</p>
            <span className="text-xs text-slate-500">Estimated with protocol fee schedules</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-3 p-6">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Average APR</span>
            <p className="text-2xl font-semibold text-somnia-primary">{formatApr(totals.avgApr)}</p>
            <span className="text-xs text-slate-500">Calculated from rolling 24h performance</span>
          </CardContent>
        </Card>
      </section>

      <MetricsCharts metrics={sortedMetrics.slice(0, 6)} />

      <MetricsTable metrics={sortedMetrics} sort={sort} onSortChange={setSort} />
    </div>
  );
}
