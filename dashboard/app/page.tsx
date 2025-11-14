"use client";

import MetricsDashboard from "@/components/metrics-dashboard";

export default function Home() {
  // Metrics are fetched client-side by the dashboard component via /api/metrics.
  return (
    <main className="min-h-screen bg-transparent px-6 py-10">
      <div className="mx-auto w-full max-w-7xl">
        <MetricsDashboard initialMetrics={[]} />
      </div>
    </main>
  );
}
