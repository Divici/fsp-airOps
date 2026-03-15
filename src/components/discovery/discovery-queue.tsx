"use client";

import { Suspense } from "react";
import { ProspectFilters, useProspectFilters } from "./prospect-filters";
import { ProspectList } from "./prospect-list";
import { useProspects } from "@/lib/hooks/use-prospects";
import type { ProspectFilters as Filters } from "@/lib/types/prospect-filters";

interface DiscoveryQueueProps {
  defaultStatus?: Filters["status"];
  title: string;
}

function DiscoveryQueueInner({
  defaultStatus = "all",
  title,
}: DiscoveryQueueProps) {
  const filters = useProspectFilters(defaultStatus);
  const { data, isLoading, isError, refetch } = useProspects(filters);

  const hasActiveFilters = filters.status !== defaultStatus;

  return (
    <div className="flex flex-col gap-4 p-4 lg:p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
        <p className="text-xs text-muted-foreground">
          Manage discovery flight inquiries and track their progress.
        </p>
      </div>

      <ProspectFilters defaultStatus={defaultStatus} />

      <ProspectList
        prospects={data}
        isLoading={isLoading}
        isError={isError}
        hasActiveFilters={hasActiveFilters}
        onRetry={() => refetch()}
      />
    </div>
  );
}

/**
 * Wraps the queue in Suspense for useSearchParams().
 */
export function DiscoveryQueue(props: DiscoveryQueueProps) {
  return (
    <Suspense fallback={null}>
      <DiscoveryQueueInner {...props} />
    </Suspense>
  );
}
