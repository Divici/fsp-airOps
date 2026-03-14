"use client";

import { MetricsGrid } from "./metrics-grid";
import { RecentActivity } from "./recent-activity";

export function DashboardOverview() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Scheduling overview and recent activity
        </p>
      </div>

      <MetricsGrid />

      <div className="grid gap-6 lg:grid-cols-2">
        <RecentActivity />
      </div>
    </div>
  );
}
