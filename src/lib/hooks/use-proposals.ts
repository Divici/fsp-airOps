"use client";

import { useQuery } from "@tanstack/react-query";
import type { ProposalFilters } from "@/lib/types/proposal-filters";
import type { ProposalView } from "@/lib/types/proposal-view";
import { apiFetch } from "@/lib/api/client";

export function useProposals(filters: ProposalFilters) {
  return useQuery({
    queryKey: ["proposals", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.status !== "all") params.set("status", filters.status);
      if (filters.workflowType !== "all")
        params.set("workflowType", filters.workflowType);
      params.set("page", "1");
      params.set("limit", "50");

      if (filters.dateRange === "today") {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        params.set("startDate", today.toISOString());
        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);
        params.set("endDate", endOfDay.toISOString());
      } else if (filters.dateRange === "week") {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        weekAgo.setHours(0, 0, 0, 0);
        params.set("startDate", weekAgo.toISOString());
        params.set("endDate", new Date().toISOString());
      }

      const data = await apiFetch<{
        proposals: ProposalView[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
      }>(`/api/proposals?${params.toString()}`);
      return data.proposals;
    },
  });
}
