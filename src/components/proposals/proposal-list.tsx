"use client";

import { FileText, AlertCircle, Inbox } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ProposalCard } from "./proposal-card";
import type { ProposalView } from "@/lib/types/proposal-view";

interface ProposalListProps {
  proposals: ProposalView[] | undefined;
  isLoading: boolean;
  isError: boolean;
  hasActiveFilters: boolean;
  selectionMode?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
}

export function ProposalList({
  proposals,
  isLoading,
  isError,
  hasActiveFilters,
  selectionMode,
  selectedIds,
  onToggleSelect,
}: ProposalListProps) {
  if (isLoading) {
    return <ProposalListSkeleton />;
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-16 text-destructive">
        <AlertCircle className="size-8 opacity-60" />
        <p className="text-sm font-medium">Failed to load proposals</p>
        <p className="text-xs text-muted-foreground">
          Please try refreshing the page.
        </p>
      </div>
    );
  }

  if (!proposals || proposals.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
        {hasActiveFilters ? (
          <>
            <FileText className="size-8 opacity-40" />
            <p className="text-sm font-medium">
              No proposals match your filters
            </p>
            <p className="text-xs">Try adjusting the filters above.</p>
          </>
        ) : (
          <>
            <Inbox className="size-8 opacity-40" />
            <p className="text-sm font-medium">No pending proposals</p>
            <p className="max-w-sm text-center text-xs">
              The system will generate suggestions when schedule opportunities
              arise.
            </p>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-muted-foreground">
        {proposals.length} proposal{proposals.length !== 1 ? "s" : ""}
      </p>
      <div className="flex flex-col gap-2">
        {proposals.map((proposal) => (
          <ProposalCard
            key={proposal.id}
            proposal={proposal}
            selectionMode={selectionMode}
            selected={selectedIds?.has(proposal.id)}
            onToggleSelect={onToggleSelect}
          />
        ))}
      </div>
    </div>
  );
}

function ProposalListSkeleton() {
  return (
    <div className="flex flex-col gap-2" data-testid="proposal-list-skeleton">
      <Skeleton className="h-4 w-24" />
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-32 w-full rounded-xl" />
      ))}
    </div>
  );
}
