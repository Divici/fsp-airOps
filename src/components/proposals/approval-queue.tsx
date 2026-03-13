"use client";

import { Suspense } from "react";
import { ProposalFilters, useProposalFilters } from "./proposal-filters";
import { ProposalList } from "./proposal-list";
import { useProposals } from "@/lib/hooks/use-proposals";
import type { ProposalFilters as Filters } from "@/lib/types/proposal-filters";

interface ApprovalQueueProps {
  defaultStatus?: Filters["status"];
  title: string;
}

function ApprovalQueueInner({ defaultStatus = "pending", title }: ApprovalQueueProps) {
  const filters = useProposalFilters(defaultStatus);
  const { data, isLoading, isError } = useProposals(filters);

  const hasActiveFilters =
    filters.status !== defaultStatus ||
    filters.workflowType !== "all" ||
    filters.dateRange !== "all";

  return (
    <div className="flex flex-col gap-4 p-4 lg:p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
        <p className="text-xs text-muted-foreground">
          Review and act on scheduling proposals.
        </p>
      </div>

      <ProposalFilters defaultStatus={defaultStatus} />

      <ProposalList
        proposals={data}
        isLoading={isLoading}
        isError={isError}
        hasActiveFilters={hasActiveFilters}
      />
    </div>
  );
}

/**
 * Wraps the queue in Suspense for useSearchParams().
 */
export function ApprovalQueue(props: ApprovalQueueProps) {
  return (
    <Suspense fallback={null}>
      <ApprovalQueueInner {...props} />
    </Suspense>
  );
}
