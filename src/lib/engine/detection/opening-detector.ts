// ---------------------------------------------------------------------------
// OpeningDetector — Detects schedule gaps/openings that could be filled
// ---------------------------------------------------------------------------

import type { IFspClient, ScheduleQueryParams } from "@/lib/fsp-client/types";
import type { FspScheduleResponse } from "@/lib/types/fsp";

/** A detected schedule opening (available time with no reservation). */
export interface DetectedOpening {
  /** Start of the gap. */
  start: string;
  /** End of the gap. */
  end: string;
  /** Location ID where the opening exists. */
  locationId: number;
  /** Instructor available during this gap, if identifiable. */
  instructorId?: string;
  instructorName?: string;
  /** Aircraft available during this gap, if identifiable. */
  aircraftId?: string;
  aircraftName?: string;
  /** How the opening was detected. */
  source: "cancellation" | "gap_analysis";
}

export interface OpeningDetectionResult {
  operatorId: number;
  openings: DetectedOpening[];
}

export class OpeningDetector {
  constructor(private fspClient: IFspClient) {}

  /**
   * Detect schedule gaps by analyzing the schedule for a time window.
   * Compares instructor/aircraft availability against reservations
   * to find blocks where resources are available but unused.
   */
  async detect(
    operatorId: number,
    queryParams: ScheduleQueryParams,
    expectedDailyHours: number = 8,
  ): Promise<OpeningDetectionResult> {
    const schedule = await this.fspClient.getSchedule(operatorId, queryParams);
    const openings = this.findGaps(schedule, queryParams, expectedDailyHours);

    return {
      operatorId,
      openings,
    };
  }

  /**
   * Create an opening from a known cancellation.
   * This is the simplest detection path — a cancellation directly
   * creates a known opening.
   */
  openingFromCancellation(
    locationId: number,
    start: string,
    end: string,
    instructorName?: string,
    aircraftName?: string,
  ): DetectedOpening {
    return {
      start,
      end,
      locationId,
      instructorName,
      aircraftName,
      source: "cancellation",
    };
  }

  /**
   * Analyze the schedule to find gaps between events for each instructor.
   * A gap is any period within the working window (start–end of query)
   * where an instructor has no event scheduled.
   */
  private findGaps(
    schedule: FspScheduleResponse,
    queryParams: ScheduleQueryParams,
    expectedDailyHours: number,
  ): DetectedOpening[] {
    const openings: DetectedOpening[] = [];
    const events = schedule.results.events;

    if (events.length === 0) return openings;

    // Group events by instructor
    const byInstructor = new Map<string, typeof events>();
    for (const event of events) {
      if (!event.InstructorName) continue;
      const existing = byInstructor.get(event.InstructorName) ?? [];
      existing.push(event);
      byInstructor.set(event.InstructorName, existing);
    }

    // For each instructor, find gaps in their schedule
    const queryStart = new Date(queryParams.start);
    const queryEnd = new Date(queryParams.end);

    // Build day boundaries within the query window
    const days = this.getDays(queryStart, queryEnd);

    for (const [instructorName, instrEvents] of byInstructor) {
      // Sort events by start time
      const sorted = [...instrEvents].sort(
        (a, b) => new Date(a.Start).getTime() - new Date(b.Start).getTime(),
      );

      for (const day of days) {
        const dayStart = new Date(day);
        dayStart.setHours(7, 0, 0, 0); // Working day starts at 7am
        const dayEnd = new Date(day);
        dayEnd.setHours(7 + expectedDailyHours, 0, 0, 0);

        // Get events for this day
        const dayEvents = sorted.filter((e) => {
          const eStart = new Date(e.Start);
          return (
            eStart.getTime() >= dayStart.getTime() &&
            eStart.getTime() < dayEnd.getTime()
          );
        });

        if (dayEvents.length === 0) continue;

        // Find gaps between events
        let cursor = dayStart;
        for (const event of dayEvents) {
          const eventStart = new Date(event.Start);
          const eventEnd = new Date(event.End);

          // Gap before this event
          const gapMs = eventStart.getTime() - cursor.getTime();
          const gapMinutes = gapMs / (1000 * 60);

          if (gapMinutes >= 60) {
            // Minimum 1-hour gap to be useful
            openings.push({
              start: cursor.toISOString(),
              end: eventStart.toISOString(),
              locationId: queryParams.locationIds[0] ?? 1,
              instructorName,
              source: "gap_analysis",
            });
          }

          cursor = eventEnd.getTime() > cursor.getTime() ? eventEnd : cursor;
        }

        // Gap after last event until end of working day
        const endGapMs = dayEnd.getTime() - cursor.getTime();
        const endGapMinutes = endGapMs / (1000 * 60);

        if (endGapMinutes >= 60) {
          openings.push({
            start: cursor.toISOString(),
            end: dayEnd.toISOString(),
            locationId: queryParams.locationIds[0] ?? 1,
            instructorName,
            source: "gap_analysis",
          });
        }
      }
    }

    return openings;
  }

  private getDays(start: Date, end: Date): Date[] {
    const days: Date[] = [];
    const current = new Date(start);
    current.setHours(0, 0, 0, 0);

    while (current.getTime() <= end.getTime()) {
      days.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }

    return days;
  }
}
