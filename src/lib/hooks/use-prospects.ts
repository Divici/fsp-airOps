"use client";

import { useQuery } from "@tanstack/react-query";
import type { ProspectView } from "@/lib/types/prospect-view";
import type { ProspectFilters } from "@/lib/types/prospect-filters";
import { apiFetch } from "@/lib/api/client";

export function useProspects(filters: ProspectFilters) {
  return useQuery({
    queryKey: ["prospects", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.status !== "all") params.set("status", filters.status);
      params.set("page", "1");
      params.set("limit", "50");

      const data = await apiFetch<{
        prospects: ProspectView[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
      }>(`/api/prospects?${params.toString()}`);
      return data.prospects;
    },
  });
}

export function useProspectDetail(id: string) {
  return useQuery({
    queryKey: ["prospect", id],
    queryFn: async () => {
      const data = await apiFetch<{ prospect: ProspectView }>(
        `/api/prospects/${id}`,
      );
      return data.prospect;
    },
    enabled: !!id,
  });
}
