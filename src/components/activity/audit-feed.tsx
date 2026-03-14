"use client";

import { Activity, AlertCircle, Inbox } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { AuditEventCard } from "./audit-event-card";
import type { AuditEventView } from "@/lib/types/audit-view";

interface AuditFeedProps {
  events: AuditEventView[] | undefined;
  isLoading: boolean;
  isError: boolean;
  hasActiveFilters: boolean;
}

export function AuditFeed({
  events,
  isLoading,
  isError,
  hasActiveFilters,
}: AuditFeedProps) {
  if (isLoading) {
    return <AuditFeedSkeleton />;
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-16 text-destructive">
        <AlertCircle className="size-8 opacity-60" />
        <p className="text-sm font-medium">Failed to load activity feed</p>
        <p className="text-xs text-muted-foreground">
          Please try refreshing the page.
        </p>
      </div>
    );
  }

  if (!events || events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
        {hasActiveFilters ? (
          <>
            <Activity className="size-8 opacity-40" />
            <p className="text-sm font-medium">No events match your filters</p>
            <p className="text-xs">Try adjusting the filters above.</p>
          </>
        ) : (
          <>
            <Inbox className="size-8 opacity-40" />
            <p className="text-sm font-medium">No activity yet</p>
            <p className="max-w-sm text-center text-xs">
              Events will appear here as the system processes triggers and
              proposals.
            </p>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-muted-foreground">
        {events.length} event{events.length !== 1 ? "s" : ""}
      </p>
      <div className="flex flex-col gap-2">
        {events.map((event) => (
          <AuditEventCard key={event.id} event={event} />
        ))}
      </div>
    </div>
  );
}

function AuditFeedSkeleton() {
  return (
    <div className="flex flex-col gap-2" data-testid="audit-feed-skeleton">
      <Skeleton className="h-4 w-24" />
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-20 w-full rounded-xl" />
      ))}
    </div>
  );
}
