"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useCallback, useMemo } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ProspectFilters as Filters } from "@/lib/types/prospect-filters";
import type { ProspectStatus } from "@/lib/types/domain";

const statusOptions: { value: ProspectStatus | "all"; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "new", label: "New" },
  { value: "processing", label: "Processing" },
  { value: "proposed", label: "Proposed" },
  { value: "approved", label: "Approved" },
  { value: "booked", label: "Booked" },
  { value: "cancelled", label: "Cancelled" },
];

interface ProspectFiltersProps {
  defaultStatus?: Filters["status"];
}

export function ProspectFilters({
  defaultStatus = "all",
}: ProspectFiltersProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const filters: Filters = useMemo(
    () => ({
      status:
        (searchParams.get("status") as Filters["status"]) ?? defaultStatus,
    }),
    [searchParams, defaultStatus]
  );

  const setFilter = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value === "all" || value === defaultStatus) {
        params.delete(key);
      } else {
        params.set(key, value);
      }
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [searchParams, router, pathname, defaultStatus]
  );

  return (
    <div
      className="flex flex-wrap items-center gap-2"
      data-testid="prospect-filters"
    >
      <Select
        value={filters.status}
        onValueChange={(v) => setFilter("status", v as string)}
      >
        <SelectTrigger size="sm" aria-label="Filter by status">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          {statusOptions.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/**
 * Read current filters from search params (for use in parent components).
 */
export function useProspectFilters(
  defaultStatus: Filters["status"] = "all"
): Filters {
  const searchParams = useSearchParams();
  return useMemo(
    () => ({
      status:
        (searchParams.get("status") as Filters["status"]) ?? defaultStatus,
    }),
    [searchParams, defaultStatus]
  );
}
