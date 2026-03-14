"use client";

import { Plane, AlertCircle, Inbox } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ProspectCard } from "./prospect-card";
import type { ProspectView } from "@/lib/types/prospect-view";

interface ProspectListProps {
  prospects: ProspectView[] | undefined;
  isLoading: boolean;
  isError: boolean;
  hasActiveFilters: boolean;
}

export function ProspectList({
  prospects,
  isLoading,
  isError,
  hasActiveFilters,
}: ProspectListProps) {
  if (isLoading) {
    return <ProspectListSkeleton />;
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-16 text-destructive">
        <AlertCircle className="size-8 opacity-60" />
        <p className="text-sm font-medium">Failed to load prospect requests</p>
        <p className="text-xs text-muted-foreground">
          Please try refreshing the page.
        </p>
      </div>
    );
  }

  if (!prospects || prospects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
        {hasActiveFilters ? (
          <>
            <Plane className="size-8 opacity-40" />
            <p className="text-sm font-medium">
              No prospects match your filters
            </p>
            <p className="text-xs">Try adjusting the filters above.</p>
          </>
        ) : (
          <>
            <Inbox className="size-8 opacity-40" />
            <p className="text-sm font-medium">No discovery flight requests</p>
            <p className="max-w-sm text-center text-xs">
              New prospect inquiries will appear here when they are submitted.
            </p>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-muted-foreground">
        {prospects.length} request{prospects.length !== 1 ? "s" : ""}
      </p>
      <div className="flex flex-col gap-2">
        {prospects.map((prospect) => (
          <ProspectCard key={prospect.id} prospect={prospect} />
        ))}
      </div>
    </div>
  );
}

function ProspectListSkeleton() {
  return (
    <div className="flex flex-col gap-2" data-testid="prospect-list-skeleton">
      <Skeleton className="h-4 w-24" />
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-28 w-full rounded-xl" />
      ))}
    </div>
  );
}
