"use client";

import { useQuery } from "@tanstack/react-query";
import type { AuditEventView } from "@/lib/types/audit-view";
import type { AuditEventType } from "@/lib/types/audit";
import { apiFetch } from "@/lib/api/client";

// ---------------------------------------------------------------------------
// Filter types
// ---------------------------------------------------------------------------

export interface AuditFeedFilters {
  eventType: AuditEventType | "all";
  dateRange: "all" | "today" | "week";
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useAuditFeed(filters: AuditFeedFilters) {
  return useQuery({
    queryKey: ["audit-feed", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.eventType !== "all")
        params.set("eventType", filters.eventType);
      params.set("page", "1");
      params.set("limit", "50");

      if (filters.dateRange === "today") {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        params.set("startDate", today.toISOString());
      } else if (filters.dateRange === "week") {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        weekAgo.setHours(0, 0, 0, 0);
        params.set("startDate", weekAgo.toISOString());
      }

      const data = await apiFetch<{
        events: AuditEventView[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
      }>(`/api/audit?${params.toString()}`);
      return data.events;
    },
  });
}
