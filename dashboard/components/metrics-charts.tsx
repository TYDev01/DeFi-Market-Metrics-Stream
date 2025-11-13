"use client";

import { useMemo } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from "chart.js";
import { Line, Bar } from "react-chartjs-2";
import { PriceMetric } from "@/lib/types";
import { formatPercent } from "@/lib/utils";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, Filler);

interface MetricsChartsProps {
  metrics: PriceMetric[];
}

export default function MetricsCharts({ metrics }: MetricsChartsProps) {
  const defaultQuote = metrics[0]?.quoteToken ?? "USD";

  const lineChartData = useMemo(() => {
    return {
      labels: metrics.map((metric) => metric.pairId),
      datasets: [
        {
          label: "Price",
          data: metrics.map((metric) => metric.price),
          borderColor: "#4731ff",
          backgroundColor: "rgba(71, 49, 255, 0.2)",
          fill: true,
          tension: 0.35
        }
      ]
    };
  }, [metrics]);

  const barChartData = useMemo(() => {
    return {
      labels: metrics.map((metric) => metric.pairId),
      datasets: [
        {
          label: "Absolute Δ %",
          data: metrics.map((metric) => Math.abs(metric.priceDeltaPercent)),
          backgroundColor: "rgba(3, 150, 253, 0.7)",
          borderRadius: 8
        },
        {
          label: "Signed Δ %",
          data: metrics.map((metric) => metric.priceDeltaPercent),
          backgroundColor: "rgba(3, 150, 253, 0.35)",
          borderRadius: 8
        }
      ]
    };
  }, [metrics]);

  const baseOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: "bottom" as const,
        labels: {
          color: "#e2e8f0"
        }
      },
      tooltip: {
        callbacks: {
          label: (tooltipItem: any) => {
            const value = Number(tooltipItem.raw).toLocaleString(undefined, {
              maximumFractionDigits: tooltipItem.dataset.label === "Price" ? 4 : 2
            });
            const suffix = tooltipItem.dataset.label === "Price" ? ` ${defaultQuote}` : " %";
            return `${tooltipItem.dataset.label}: ${value}${suffix}`;
          }
        },
        backgroundColor: "rgba(6, 8, 25, 0.9)",
        borderColor: "rgba(255, 255, 255, 0.1)",
        borderWidth: 1,
        titleColor: "#fff",
        bodyColor: "#cbd5f5"
      }
    },
    scales: {
      y: {
        ticks: {
          color: "#cbd5f5",
          callback: (value: any) => `${Number(value).toLocaleString()}`
        },
        grid: {
          color: "rgba(148, 163, 184, 0.15)"
        }
      },
      x: {
        ticks: {
          color: "#cbd5f5"
        },
        grid: {
          color: "rgba(148, 163, 184, 0.08)"
        }
      }
    }
  };

  const priceOptions = {
    ...baseOptions,
    plugins: {
      ...baseOptions.plugins
    },
    scales: {
      ...baseOptions.scales,
      y: {
        ...baseOptions.scales.y,
        ticks: {
          ...baseOptions.scales.y.ticks,
          callback: (value: any) => `${Number(value).toLocaleString()} ${defaultQuote}`
        }
      }
    }
  };

  const changeOptions = {
    ...baseOptions,
    plugins: {
      ...baseOptions.plugins
    },
    scales: {
      ...baseOptions.scales,
      y: {
        ...baseOptions.scales.y,
        ticks: {
          ...baseOptions.scales.y.ticks,
          callback: (value: any) => formatPercent(Number(value))
        }
      }
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="h-[320px] rounded-2xl border border-white/10 bg-somnia-card/80 p-4 text-slate-100 shadow-soft backdrop-blur-xl">
        <h3 className="text-sm font-semibold text-white">Tracked prices</h3>
        <div className="h-full">
          <Line data={lineChartData} options={priceOptions} />
        </div>
      </div>
      <div className="h-[320px] rounded-2xl border border-white/10 bg-somnia-card/80 p-4 text-slate-100 shadow-soft backdrop-blur-xl">
        <h3 className="text-sm font-semibold text-white">Price moves (Δ %)</h3>
        <div className="h-full">
          <Bar data={barChartData} options={changeOptions} />
        </div>
      </div>
    </div>
  );
}
