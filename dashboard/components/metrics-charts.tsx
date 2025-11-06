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
import { DefiMetric } from "@/lib/types";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, Filler);

interface MetricsChartsProps {
  metrics: DefiMetric[];
}

export default function MetricsCharts({ metrics }: MetricsChartsProps) {
  const lineChartData = useMemo(() => {
    return {
      labels: metrics.map((metric) => metric.poolId),
      datasets: [
        {
          label: "TVL (USD)",
          data: metrics.map((metric) => metric.tvlUsd),
          borderColor: "#4731ff",
          backgroundColor: "rgba(71, 49, 255, 0.15)",
          fill: true,
          tension: 0.35
        }
      ]
    };
  }, [metrics]);

  const barChartData = useMemo(() => {
    return {
      labels: metrics.map((metric) => metric.poolId),
      datasets: [
        {
          label: "Volume 24h (USD)",
          data: metrics.map((metric) => metric.volume24hUsd),
          backgroundColor: "rgba(71, 49, 255, 0.7)",
          borderRadius: 8
        },
        {
          label: "Fees 24h (USD)",
          data: metrics.map((metric) => metric.fees24hUsd),
          backgroundColor: "rgba(71, 49, 255, 0.3)",
          borderRadius: 8
        }
      ]
    };
  }, [metrics]);

  const sharedOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: "bottom" as const
      },
      tooltip: {
        callbacks: {
          label: (tooltipItem: any) =>
            `${tooltipItem.dataset.label}: $${Number(tooltipItem.raw).toLocaleString(undefined, {
              maximumFractionDigits: 2
            })}`
        }
      }
    },
    scales: {
      y: {
        ticks: {
          callback: (value: any) => `$${Number(value).toLocaleString()}`
        },
        grid: {
          color: "rgba(148, 163, 184, 0.15)"
        }
      },
      x: {
        grid: {
          color: "rgba(148, 163, 184, 0.1)"
        }
      }
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="h-[320px] rounded-2xl border border-slate-200 bg-white p-4 shadow-soft">
        <h3 className="text-sm font-semibold text-slate-700">Total Value Locked</h3>
        <div className="h-full">
          <Line data={lineChartData} options={sharedOptions} />
        </div>
      </div>
      <div className="h-[320px] rounded-2xl border border-slate-200 bg-white p-4 shadow-soft">
        <h3 className="text-sm font-semibold text-slate-700">Volume & Fees (24h)</h3>
        <div className="h-full">
          <Bar data={barChartData} options={sharedOptions} />
        </div>
      </div>
    </div>
  );
}
