import MetricsDashboard from "@/components/metrics-dashboard";
import { getInitialMetrics } from "@/lib/somnia";

export default async function Home() {
  const metrics = await getInitialMetrics();

  return (
    <main className="min-h-screen bg-transparent px-6 py-10">
      <div className="mx-auto w-full max-w-7xl">
        <MetricsDashboard initialMetrics={metrics} />
      </div>
    </main>
  );
}
