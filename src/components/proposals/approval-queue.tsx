"use client";

import { Suspense } from "react";
import { ProposalFilters, useProposalFilters } from "./proposal-filters";
import { ProposalList } from "./proposal-list";
import { BatchActions } from "./batch-actions";
import { useProposals } from "@/lib/hooks/use-proposals";
import { useBatchApproval } from "@/lib/hooks/use-batch-approval";
import type { ProposalFilters as Filters } from "@/lib/types/proposal-filters";

interface ApprovalQueueProps {
  defaultStatus?: Filters["status"];
  title: string;
}

function ApprovalQueueInner({ defaultStatus = "pending", title }: ApprovalQueueProps) {
  const filters = useProposalFilters(defaultStatus);
  const { data, isLoading, isError, refetch } = useProposals(filters);
  const batch = useBatchApproval();

  const hasActiveFilters =
    filters.status !== defaultStatus ||
    filters.workflowType !== "all" ||
    filters.dateRange !== "all";

  // Only pending proposals can be batch-selected
  const pendingProposals = data?.filter((p) => p.status === "pending") ?? [];
  const pendingIds = pendingProposals.map((p) => p.id);

  const selectionMode = batch.selectedCount > 0 || pendingProposals.length > 0;
  const allSelected =
    pendingIds.length > 0 &&
    pendingIds.every((id) => batch.selectedIds.has(id));

  return (
    <div className="flex flex-col gap-4 p-4 lg:p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
        <p className="text-xs text-muted-foreground">
          Review and act on scheduling proposals.
        </p>
      </div>

      <ProposalFilters defaultStatus={defaultStatus} />

      {/* Batch action bar for pending proposals */}
      {pendingProposals.length > 0 && (
        <BatchActions
          selectedCount={batch.selectedCount}
          totalCount={pendingIds.length}
          onSelectAll={() => batch.selectAll(pendingIds)}
          onClearSelection={batch.clearSelection}
          onBatchApprove={async () => {
            await batch.batchApprove(Array.from(batch.selectedIds));
            batch.clearSelection();
          }}
          onBatchDecline={async () => {
            await batch.batchDecline(Array.from(batch.selectedIds));
            batch.clearSelection();
          }}
          isApproving={batch.isApproving}
          isDeclining={batch.isDeclining}
          allSelected={allSelected}
        />
      )}

      <ProposalList
        proposals={data}
        isLoading={isLoading}
        isError={isError}
        hasActiveFilters={hasActiveFilters}
        selectionMode={selectionMode}
        selectedIds={batch.selectedIds}
        onToggleSelect={batch.toggleSelect}
        onRetry={() => refetch()}
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
