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
import type { ProposalFilters as Filters } from "@/lib/types/proposal-filters";
import type { ProposalStatus, WorkflowType } from "@/lib/types/domain";
import type { DateRange } from "@/lib/types/proposal-filters";

const statusOptions: { value: ProposalStatus | "all"; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "declined", label: "Declined" },
  { value: "expired", label: "Expired" },
  { value: "executed", label: "Executed" },
];

const workflowOptions: { value: WorkflowType | "all"; label: string }[] = [
  { value: "all", label: "All types" },
  { value: "reschedule", label: "Reschedule" },
  { value: "discovery_flight", label: "Discovery Flight" },
  { value: "next_lesson", label: "Next Lesson" },
  { value: "waitlist", label: "Waitlist" },
];

const dateOptions: { value: DateRange; label: string }[] = [
  { value: "all", label: "All time" },
  { value: "today", label: "Today" },
  { value: "week", label: "This week" },
];

interface ProposalFiltersProps {
  defaultStatus?: Filters["status"];
}

export function ProposalFilters({ defaultStatus = "pending" }: ProposalFiltersProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const filters: Filters = useMemo(
    () => ({
      status: (searchParams.get("status") as Filters["status"]) ?? defaultStatus,
      workflowType: (searchParams.get("type") as Filters["workflowType"]) ?? "all",
      dateRange: (searchParams.get("date") as DateRange) ?? "all",
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
    <div className="flex flex-wrap items-center gap-3" data-testid="proposal-filters">
      <div className="flex items-center gap-1.5">
        <span className="text-xs font-medium text-muted-foreground">Status</span>
        <Select value={filters.status} onValueChange={(v) => setFilter("status", v as string)}>
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

      <div className="flex items-center gap-1.5">
        <span className="text-xs font-medium text-muted-foreground">Type</span>
        <Select
          value={filters.workflowType}
          onValueChange={(v) => setFilter("type", v as string)}
        >
          <SelectTrigger size="sm" aria-label="Filter by workflow type">
            <SelectValue placeholder="Workflow" />
          </SelectTrigger>
          <SelectContent>
            {workflowOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-1.5">
        <span className="text-xs font-medium text-muted-foreground">Period</span>
        <Select value={filters.dateRange} onValueChange={(v) => setFilter("date", v as string)}>
          <SelectTrigger size="sm" aria-label="Filter by date range">
            <SelectValue placeholder="Date" />
          </SelectTrigger>
          <SelectContent>
            {dateOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

/**
 * Read current filters from search params (for use in parent server/client components).
 */
export function useProposalFilters(defaultStatus: Filters["status"] = "pending"): Filters {
  const searchParams = useSearchParams();
  return useMemo(
    () => ({
      status: (searchParams.get("status") as Filters["status"]) ?? defaultStatus,
      workflowType: (searchParams.get("type") as Filters["workflowType"]) ?? "all",
      dateRange: (searchParams.get("date") as DateRange) ?? "all",
    }),
    [searchParams, defaultStatus]
  );
}
