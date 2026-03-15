"use client";

import { Plane, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ProspectCard } from "./prospect-card";
import type { ProspectView } from "@/lib/types/prospect-view";

interface ProspectListProps {
  prospects: ProspectView[] | undefined;
  isLoading: boolean;
  isError: boolean;
  hasActiveFilters: boolean;
  onRetry?: () => void;
}

export function ProspectList({
  prospects,
  isLoading,
  isError,
  hasActiveFilters,
  onRetry,
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
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            Try again
          </Button>
        )}
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
            <Plane className="size-8 opacity-40" />
            <p className="text-sm font-medium">
              No discovery flight requests yet
            </p>
            <p className="max-w-sm text-center text-xs">
              Prospects can submit requests via the intake form at /book/1
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
