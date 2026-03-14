"use client";

import { Suspense } from "react";
import { AuditFeed } from "@/components/activity/audit-feed";
import { AuditFilters, useAuditFilters } from "@/components/activity/audit-filters";
import { useAuditFeed } from "@/lib/hooks/use-audit-feed";

function ActivityContent() {
  const filters = useAuditFilters();
  const { data, isLoading, isError } = useAuditFeed(filters);
  const hasActiveFilters =
    filters.eventType !== "all" || filters.dateRange !== "all";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Activity</h1>
          <p className="text-sm text-muted-foreground">
            Audit trail of all system events
          </p>
        </div>
      </div>

      <Suspense fallback={null}>
        <AuditFilters />
      </Suspense>

      <AuditFeed
        events={data}
        isLoading={isLoading}
        isError={isError}
        hasActiveFilters={hasActiveFilters}
      />
    </div>
  );
}

export default function ActivityPage() {
  return (
    <Suspense fallback={null}>
      <ActivityContent />
    </Suspense>
  );
}
