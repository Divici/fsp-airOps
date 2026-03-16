"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  startOfWeek,
  endOfWeek,
  addWeeks,
  subWeeks,
  format,
  parseISO,
} from "date-fns";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { WeeklyCalendar } from "@/components/schedule/weekly-calendar";
import { useSchedule } from "@/lib/hooks/use-schedule";

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function CalendarSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {/* Header row skeleton */}
      <div className="grid grid-cols-[60px_repeat(7,1fr)] gap-0">
        <Skeleton className="h-12" />
        {Array.from({ length: 7 }, (_, i) => (
          <Skeleton key={i} className="h-12" />
        ))}
      </div>
      {/* Body skeleton */}
      <Skeleton className="h-[500px] w-full rounded-lg" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Schedule page
// ---------------------------------------------------------------------------

function getInitialWeek(weekParam: string | null): Date {
  if (weekParam) {
    try {
      return startOfWeek(parseISO(weekParam), { weekStartsOn: 1 });
    } catch {
      // Fall through to default
    }
  }
  return startOfWeek(new Date(), { weekStartsOn: 1 });
}

function ScheduleContent() {
  const searchParams = useSearchParams();
  const weekParam = searchParams.get("week");

  const [weekStart, setWeekStart] = useState(() =>
    getInitialWeek(weekParam)
  );

  const weekEnd = useMemo(
    () => endOfWeek(weekStart, { weekStartsOn: 1 }),
    [weekStart]
  );

  const startDate = format(weekStart, "yyyy-MM-dd");
  const endDate = format(weekEnd, "yyyy-MM-dd");

  const { data: events, isLoading, isError } = useSchedule(startDate, endDate);

  const goToPreviousWeek = () => setWeekStart((w) => subWeeks(w, 1));
  const goToNextWeek = () => setWeekStart((w) => addWeeks(w, 1));
  const goToToday = () =>
    setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));

  const weekLabel = `${format(weekStart, "MMM d")} – ${format(weekEnd, "MMM d, yyyy")}`;

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold">Schedule</h1>
          <p className="text-sm text-muted-foreground">
            Read-only view of upcoming reservations
          </p>
        </div>

        {/* Week navigation */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={goToToday}>
            Today
          </Button>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={goToPreviousWeek}
              aria-label="Previous week"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span className="min-w-[160px] text-center text-sm font-medium">
              {weekLabel}
            </span>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={goToNextWeek}
              aria-label="Next week"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Calendar content */}
      {isLoading ? (
        <CalendarSkeleton />
      ) : isError ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-muted/30 py-16 text-center">
          <CalendarDays className="size-10 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">Failed to load schedule</p>
            <p className="text-xs text-muted-foreground">
              Please try again later.
            </p>
          </div>
        </div>
      ) : events && events.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-muted/30 py-16 text-center">
          <CalendarDays className="size-10 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">No reservations this week</p>
            <p className="text-xs text-muted-foreground">
              Try navigating to a different week.
            </p>
          </div>
        </div>
      ) : events ? (
        <WeeklyCalendar events={events} weekStart={weekStart} />
      ) : null}
    </div>
  );
}

export default function SchedulePage() {
  return (
    <Suspense fallback={<CalendarSkeleton />}>
      <ScheduleContent />
    </Suspense>
  );
}
