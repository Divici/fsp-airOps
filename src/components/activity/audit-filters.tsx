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
import type { AuditFeedFilters } from "@/lib/hooks/use-audit-feed";
import type { AuditEventType } from "@/lib/types/audit";

const eventTypeOptions: { value: AuditEventType | "all"; label: string }[] = [
  { value: "all", label: "All events" },
  { value: "trigger_received", label: "Trigger Received" },
  { value: "trigger_processed", label: "Trigger Processed" },
  { value: "trigger_failed", label: "Trigger Failed" },
  { value: "trigger_skipped", label: "Trigger Skipped" },
  { value: "proposal_generated", label: "Proposal Generated" },
  { value: "proposal_expired", label: "Proposal Expired" },
  { value: "proposal_approved", label: "Proposal Approved" },
  { value: "proposal_declined", label: "Proposal Declined" },
  { value: "validation_passed", label: "Validation Passed" },
  { value: "validation_failed", label: "Validation Failed" },
  { value: "reservation_created", label: "Reservation Created" },
  { value: "reservation_failed", label: "Reservation Failed" },
  { value: "email_sent", label: "Email Sent" },
  { value: "email_failed", label: "Email Failed" },
  { value: "sms_sent", label: "SMS Sent" },
  { value: "sms_failed", label: "SMS Failed" },
];

const dateOptions: { value: AuditFeedFilters["dateRange"]; label: string }[] = [
  { value: "all", label: "All time" },
  { value: "today", label: "Today" },
  { value: "week", label: "This week" },
];

export function AuditFilters() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const filters: AuditFeedFilters = useMemo(
    () => ({
      eventType:
        (searchParams.get("eventType") as AuditFeedFilters["eventType"]) ??
        "all",
      dateRange:
        (searchParams.get("date") as AuditFeedFilters["dateRange"]) ?? "all",
    }),
    [searchParams]
  );

  const setFilter = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value === "all") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [searchParams, router, pathname]
  );

  return (
    <div
      className="flex flex-wrap items-center gap-2"
      data-testid="audit-filters"
    >
      <Select
        value={filters.eventType}
        onValueChange={(v) => setFilter("eventType", v as string)}
      >
        <SelectTrigger size="sm" aria-label="Filter by event type">
          <SelectValue placeholder="Event type" />
        </SelectTrigger>
        <SelectContent>
          {eventTypeOptions.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.dateRange}
        onValueChange={(v) => setFilter("date", v as string)}
      >
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
  );
}

/**
 * Read current audit filters from search params.
 */
export function useAuditFilters(): AuditFeedFilters {
  const searchParams = useSearchParams();
  return useMemo(
    () => ({
      eventType:
        (searchParams.get("eventType") as AuditFeedFilters["eventType"]) ??
        "all",
      dateRange:
        (searchParams.get("date") as AuditFeedFilters["dateRange"]) ?? "all",
    }),
    [searchParams]
  );
}
