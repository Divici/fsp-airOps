"use client";

import { Info } from "lucide-react";
import { MetricsGrid } from "./metrics-grid";
import { RecentActivity } from "./recent-activity";
import {
  useDashboardMetrics,
  useRecentActivity,
} from "@/lib/hooks/use-dashboard-metrics";
import { useAutoApprovalToasts } from "@/lib/hooks/use-auto-approval-toasts";

export function DashboardOverview() {
  const { data: activityData } = useRecentActivity();
  const { data: metrics } = useDashboardMetrics();
  useAutoApprovalToasts(activityData);

  const allMetricsZero =
    metrics &&
    metrics.pendingProposals === 0 &&
    metrics.executedToday === 0 &&
    metrics.approvedToday === 0 &&
    metrics.declinedToday === 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Scheduling overview and recent activity
        </p>
      </div>

      <MetricsGrid />

      {allMetricsZero && (
        <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950/30">
          <Info className="mt-0.5 size-4 flex-shrink-0 text-blue-600 dark:text-blue-400" />
          <p className="text-sm text-blue-800 dark:text-blue-300">
            The system generates proposals automatically when schedule events
            are detected. You can also trigger evaluations manually.
          </p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <RecentActivity />
      </div>
    </div>
  );
}
