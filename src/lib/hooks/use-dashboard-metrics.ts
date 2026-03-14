"use client";

import { useQuery } from "@tanstack/react-query";
import type {
  DashboardMetrics,
  RecentActivityItem,
} from "@/lib/types/dashboard-metrics";
import { apiFetch } from "@/lib/api/client";

export function useDashboardMetrics() {
  return useQuery({
    queryKey: ["dashboard-metrics"],
    queryFn: async () => {
      const data = await apiFetch<{
        metrics: DashboardMetrics;
        recentActivity: RecentActivityItem[];
      }>(`/api/dashboard/metrics`);
      return data.metrics;
    },
    refetchInterval: 30_000,
  });
}

export function useRecentActivity() {
  return useQuery({
    queryKey: ["recent-activity"],
    queryFn: async () => {
      const data = await apiFetch<{
        metrics: DashboardMetrics;
        recentActivity: RecentActivityItem[];
      }>(`/api/dashboard/metrics`);
      return data.recentActivity;
    },
    refetchInterval: 30_000,
  });
}
