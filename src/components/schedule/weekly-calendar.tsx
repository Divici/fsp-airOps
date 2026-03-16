"use client";

import { useMemo, useState } from "react";
import { format, isSameDay, addDays } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { ScheduleEvent } from "@/lib/hooks/use-schedule";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const HOUR_START = 6; // 6:00 AM
const HOUR_END = 20; // 8:00 PM
const TOTAL_HOURS = HOUR_END - HOUR_START;
const HOUR_HEIGHT_PX = 60;
const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getWeekDays(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

interface EventLayout {
  top: number;
  height: number;
  left: string;
  width: string;
}

function getEventPosition(event: ScheduleEvent): { top: number; height: number } {
  const start = new Date(event.start);
  const end = new Date(event.end);

  const startHour = start.getHours() + start.getMinutes() / 60;
  const endHour = end.getHours() + end.getMinutes() / 60;

  const topOffset = Math.max(0, startHour - HOUR_START);
  const duration = Math.min(endHour, HOUR_END) - Math.max(startHour, HOUR_START);

  return {
    top: topOffset * HOUR_HEIGHT_PX,
    height: Math.max(duration * HOUR_HEIGHT_PX, 20),
  };
}

/** Compute horizontal layout for overlapping events in a single day. */
function layoutDayEvents(events: ScheduleEvent[]): Map<string, EventLayout> {
  const layouts = new Map<string, EventLayout>();
  if (events.length === 0) return layouts;

  // Sort by start time
  const sorted = [...events].sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
  );

  // Assign columns using a greedy algorithm
  const columns: { end: number; eventId: string }[][] = [];

  for (const event of sorted) {
    const startMs = new Date(event.start).getTime();
    const endMs = new Date(event.end).getTime();

    // Find the first column group where this event doesn't overlap
    let placed = false;
    for (const col of columns) {
      const lastInCol = col[col.length - 1];
      if (lastInCol.end <= startMs) {
        col.push({ end: endMs, eventId: event.id });
        placed = true;
        break;
      }
    }
    if (!placed) {
      columns.push([{ end: endMs, eventId: event.id }]);
    }
  }

  const totalCols = columns.length;
  const padding = 2; // px gap between columns

  for (let colIndex = 0; colIndex < columns.length; colIndex++) {
    for (const entry of columns[colIndex]) {
      const event = sorted.find((e) => e.id === entry.eventId)!;
      const { top, height } = getEventPosition(event);
      const widthPct = 100 / totalCols;
      const leftPct = colIndex * widthPct;

      layouts.set(event.id, {
        top,
        height,
        left: `calc(${leftPct}% + ${padding}px)`,
        width: `calc(${widthPct}% - ${padding * 2}px)`,
      });
    }
  }

  return layouts;
}

function formatHour(hour: number): string {
  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${displayHour}:00 ${period}`;
}

// Color palette for event types
const TYPE_COLORS: Record<string, string> = {
  "Dual Flight": "bg-blue-100 border-blue-300 text-blue-900 dark:bg-blue-900/30 dark:border-blue-700 dark:text-blue-200",
  "Discovery Flight": "bg-emerald-100 border-emerald-300 text-emerald-900 dark:bg-emerald-900/30 dark:border-emerald-700 dark:text-emerald-200",
  "Solo Flight": "bg-amber-100 border-amber-300 text-amber-900 dark:bg-amber-900/30 dark:border-amber-700 dark:text-amber-200",
  "Ground School": "bg-purple-100 border-purple-300 text-purple-900 dark:bg-purple-900/30 dark:border-purple-700 dark:text-purple-200",
};

const DEFAULT_COLOR = "bg-slate-100 border-slate-300 text-slate-900 dark:bg-slate-800/50 dark:border-slate-600 dark:text-slate-200";

function getEventColor(type: string): string {
  return TYPE_COLORS[type] ?? DEFAULT_COLOR;
}

// ---------------------------------------------------------------------------
// Event block component
// ---------------------------------------------------------------------------

function EventBlock({ event, layout }: { event: ScheduleEvent; layout: EventLayout }) {
  const colorClasses = getEventColor(event.type);
  const startTime = format(new Date(event.start), "h:mm a");

  return (
    <div
      className={cn(
        "absolute overflow-hidden rounded-md border px-1.5 py-0.5 text-xs leading-tight shadow-sm",
        colorClasses
      )}
      style={{
        top: `${layout.top}px`,
        height: `${layout.height}px`,
        left: layout.left,
        width: layout.width,
      }}
      title={`${event.title}\n${event.studentName} with ${event.instructorName}\n${event.aircraftName}\n${startTime}`}
    >
      <p className="truncate font-semibold">{event.studentName}</p>
      {layout.height > 30 && (
        <p className="truncate opacity-80">{event.instructorName}</p>
      )}
      {layout.height > 50 && (
        <p className="truncate opacity-70">{event.aircraftName.split(" - ")[0]}</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mobile day selector
// ---------------------------------------------------------------------------

function MobileDaySelector({
  days,
  selectedIndex,
  onSelect,
}: {
  days: Date[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}) {
  return (
    <div className="flex items-center gap-1 md:hidden">
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => onSelect(Math.max(0, selectedIndex - 1))}
        disabled={selectedIndex === 0}
        aria-label="Previous day"
      >
        <ChevronLeft className="size-4" />
      </Button>
      <div className="flex flex-1 gap-0.5 overflow-x-auto">
        {days.map((day, i) => (
          <button
            key={i}
            onClick={() => onSelect(i)}
            className={cn(
              "flex min-w-0 flex-1 flex-col items-center rounded-md px-1.5 py-1 text-xs transition-colors",
              i === selectedIndex
                ? "bg-primary text-primary-foreground"
                : "hover:bg-muted"
            )}
          >
            <span className="font-medium">{DAY_LABELS[i]}</span>
            <span>{format(day, "d")}</span>
          </button>
        ))}
      </div>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => onSelect(Math.min(6, selectedIndex + 1))}
        disabled={selectedIndex === 6}
        aria-label="Next day"
      >
        <ChevronRight className="size-4" />
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface WeeklyCalendarProps {
  events: ScheduleEvent[];
  weekStart: Date;
}

export function WeeklyCalendar({ events, weekStart }: WeeklyCalendarProps) {
  const [mobileDay, setMobileDay] = useState(0);
  const days = useMemo(() => getWeekDays(weekStart), [weekStart]);

  // Group events by day index
  const eventsByDay = useMemo(() => {
    const grouped: ScheduleEvent[][] = Array.from({ length: 7 }, () => []);
    for (const event of events) {
      const eventDate = new Date(event.start);
      const dayIndex = days.findIndex((d) => isSameDay(d, eventDate));
      if (dayIndex >= 0) {
        grouped[dayIndex].push(event);
      }
    }
    return grouped;
  }, [events, days]);

  const today = new Date();

  return (
    <div className="flex flex-col gap-2">
      {/* Mobile day selector */}
      <MobileDaySelector
        days={days}
        selectedIndex={mobileDay}
        onSelect={setMobileDay}
      />

      {/* Calendar grid */}
      <div className="overflow-x-auto rounded-lg border border-border">
        <div className="min-w-[700px]">
          {/* Day headers */}
          <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-border bg-muted/50">
            <div className="border-r border-border" />
            {days.map((day, i) => {
              const isToday = isSameDay(day, today);
              return (
                <div
                  key={i}
                  className={cn(
                    "border-r border-border px-2 py-2 text-center text-xs last:border-r-0",
                    // On mobile, dim non-selected days
                    i !== mobileDay && "md:opacity-100 opacity-40",
                    i === mobileDay && "md:bg-transparent bg-muted"
                  )}
                >
                  <span className="font-medium text-muted-foreground">
                    {DAY_LABELS[i]}
                  </span>
                  <br />
                  <span
                    className={cn(
                      "inline-flex size-6 items-center justify-center rounded-full text-sm font-semibold",
                      isToday
                        ? "bg-primary text-primary-foreground"
                        : "text-foreground"
                    )}
                  >
                    {format(day, "d")}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Time grid */}
          <div
            className="relative grid grid-cols-[60px_repeat(7,1fr)]"
            style={{ height: `${TOTAL_HOURS * HOUR_HEIGHT_PX}px` }}
          >
            {/* Time labels */}
            <div className="relative border-r border-border">
              {Array.from({ length: TOTAL_HOURS }, (_, i) => (
                <div
                  key={i}
                  className="absolute right-2 -translate-y-1/2 text-[10px] text-muted-foreground"
                  style={{ top: `${i * HOUR_HEIGHT_PX}px` }}
                >
                  {i > 0 ? formatHour(HOUR_START + i) : ""}
                </div>
              ))}
            </div>

            {/* Day columns */}
            {days.map((_, dayIndex) => {
              const dayLayouts = layoutDayEvents(eventsByDay[dayIndex]);
              return (
                <div
                  key={dayIndex}
                  className={cn(
                    "relative border-r border-border last:border-r-0",
                    dayIndex !== mobileDay && "hidden md:block"
                  )}
                >
                  {/* Hour grid lines */}
                  {Array.from({ length: TOTAL_HOURS }, (_, i) => (
                    <div
                      key={i}
                      className="absolute inset-x-0 border-t border-border/50"
                      style={{ top: `${i * HOUR_HEIGHT_PX}px` }}
                    />
                  ))}

                  {/* Events */}
                  {eventsByDay[dayIndex].map((event) => {
                    const layout = dayLayouts.get(event.id);
                    if (!layout) return null;
                    return <EventBlock key={event.id} event={event} layout={layout} />;
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
