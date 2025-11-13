"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import FilterBar from "./filter-bar";
import MetricsTable, { SortState } from "./metrics-table";
import MetricsCharts from "./metrics-charts";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { FilterState, PriceMetric } from "@/lib/types";
import { formatPercent } from "@/lib/utils";

interface MetricsDashboardProps {
  initialMetrics: PriceMetric[];
}

const AUTO_REFRESH_INTERVAL_MS = Number(process.env.NEXT_PUBLIC_REFRESH_INTERVAL_MS ?? 60_000);
const SHOULD_AUTO_REFRESH = Number.isFinite(AUTO_REFRESH_INTERVAL_MS) && AUTO_REFRESH_INTERVAL_MS > 0;

const DEFAULT_FILTERS: FilterState = {
  search: "",
  source: "",
  minChangePercent: 0
};

export default function MetricsDashboard({ initialMetrics }: MetricsDashboardProps) {
  const router = useRouter();
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [sort, setSort] = useState<SortState>({ column: "timestamp", direction: "desc" });
  const [metrics, setMetrics] = useState<PriceMetric[]>(initialMetrics);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch fresh metrics from API
  const fetchMetrics = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch('/api/metrics', { 
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache'
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to fetch metrics: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.metrics && data.metrics.length > 0) {
        setMetrics(data.metrics);
        setError(null);
      } else {
        setError("No price data available yet. Waiting for contract to push data...");
      }
    } catch (err) {
      console.error('Error fetching metrics:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch metrics');
    } finally {
      setIsLoading(false);
    }
  };

  const sources = useMemo(
    () => Array.from(new Set(metrics.map((metric) => metric.source).filter(Boolean))).sort(),
    [metrics]
  );

  const filteredMetrics = useMemo(() => {
    const term = filters.search.toLowerCase();
    return metrics.filter((metric) => {
      const matchesSearch =
        term.length === 0 ||
        metric.pairId.toLowerCase().includes(term) ||
        metric.baseToken.toLowerCase().includes(term) ||
        metric.quoteToken.toLowerCase().includes(term);

      const matchesSource = !filters.source || metric.source === filters.source;
      const meetsChange = Math.abs(metric.priceDeltaPercent) >= filters.minChangePercent;

      return matchesSearch && matchesSource && meetsChange;
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

  const stats = useMemo(() => {
    if (metrics.length === 0) {
      return {
        trackedPairs: 0,
        avgChange: 0,
        biggestMove: 0,
        latestUpdate: "N/A"
      };
    }

    const trackedPairs = metrics.length;
    const avgChange = metrics.reduce((sum, metric) => sum + Math.abs(metric.priceDeltaPercent), 0) / trackedPairs;
    const biggestMove = metrics.reduce(
      (max, metric) => Math.max(max, Math.abs(metric.priceDeltaPercent)),
      0
    );
    const latestUpdate = new Date(Math.max(...metrics.map((metric) => metric.timestamp)) * 1000).toLocaleString();

    return { trackedPairs, avgChange, biggestMove, latestUpdate };
  }, [metrics]);

  const handleRefresh = () => {
    fetchMetrics();
  };

  // Auto-refresh metrics at the specified interval
  useEffect(() => {
    if (!SHOULD_AUTO_REFRESH) {
      return;
    }

    const id = window.setInterval(() => {
      fetchMetrics();
    }, AUTO_REFRESH_INTERVAL_MS);

    return () => window.clearInterval(id);
  }, []);

  // Initial fetch on mount to get latest data
  useEffect(() => {
    fetchMetrics();
  }, []);

  const handleSubscribe = () => {
    const url = process.env.NEXT_PUBLIC_TELEGRAM_BOT_URL ?? "https://t.me/+ix5FDQicQ1AxMmUO";
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleFilterChange = (next: Partial<FilterState>) => {
    setFilters((prev) => ({ ...prev, ...next }));
  };

  const refreshSeconds = SHOULD_AUTO_REFRESH ? Math.round(AUTO_REFRESH_INTERVAL_MS / 1000) : undefined;

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-white/10 bg-somnia-card/80 p-8 text-slate-100 shadow-soft backdrop-blur-xl">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <Image 
                src="/logo.png" 
                alt="Somnia Logo" 
                width={48} 
                height={48}
                className="rounded-lg"
                priority
              />
              <span className="text-xs uppercase tracking-[0.2em] text-somnia-primary">Somnia Streams</span>
            </div>
            <h1 className="mt-4 text-3xl font-semibold text-white">On-chain price monitors &amp; alerts</h1>
            <p className="mt-3 max-w-2xl text-sm text-slate-300">
              Chainlink Automation pushes the latest feed values into Somnia Data Streams every 10 minutes. This dashboard
              fetches real-time price data directly from on-chain Somnia streams and displays live Chainlink price feeds.
            </p>
          </div>
        </div>
        {error && (
          <div className="mt-4 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3">
            <p className="text-sm text-yellow-200">{error}</p>
          </div>
        )}
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button onClick={handleSubscribe}>Subscribe For Alerts</Button>
          <Button variant="outline" onClick={handleRefresh} disabled={isLoading}>
            {isLoading ? "Refreshing..." : "Refresh Dashboard"}
          </Button>
          <span className="text-xs text-slate-400">
            Last update: {stats.latestUpdate}
            {refreshSeconds ? ` · Auto refresh ${refreshSeconds}s` : " · Manual refresh"}
            {isLoading && " · Loading..."}
          </span>
        </div>
      </section>

      <FilterBar filters={filters} sources={sources} onFilterChange={handleFilterChange} onRefresh={handleRefresh} />

      <section className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="space-y-3 p-6">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Tracked pairs</span>
            <p className="text-2xl font-semibold text-white">{stats.trackedPairs}</p>
            <span className="text-xs text-slate-400">Configured in the updater contract</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-3 p-6">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Average move</span>
            <p className="text-2xl font-semibold text-white">{formatPercent(stats.avgChange)}</p>
            <span className="text-xs text-slate-400">Absolute % change per interval</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-3 p-6">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Largest move</span>
            <p className="text-2xl font-semibold text-white">{formatPercent(stats.biggestMove)}</p>
            <span className="text-xs text-slate-400">Outlier movement in the latest batch</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-3 p-6">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Cadence</span>
            <p className="text-2xl font-semibold text-somnia-primary">
              {refreshSeconds ? `${refreshSeconds}s dashboard refresh` : "Manual refresh"}
            </p>
            <span className="text-xs text-slate-400">Automation interval configurable on-chain</span>
          </CardContent>
        </Card>
      </section>

      <MetricsCharts metrics={sortedMetrics.slice(0, 6)} />

      <MetricsTable metrics={sortedMetrics} sort={sort} onSortChange={setSort} />
    </div>
  );
}
