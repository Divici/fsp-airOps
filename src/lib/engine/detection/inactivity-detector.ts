// ---------------------------------------------------------------------------
// InactivityDetector — Detects students with no recent or upcoming flights
// ---------------------------------------------------------------------------

import type { IFspClient } from "@/lib/fsp-client/types";
import type { FspScheduleEvent } from "@/lib/types/fsp";

export interface InactiveStudent {
  studentId: string;
  studentName: string;
  email: string;
  lastFlightDate: Date | null;
  daysSinceLastFlight: number | null;
}

export class InactivityDetector {
  constructor(private fspClient: IFspClient) {}

  /**
   * Detect students who have no reservation in the past `thresholdDays` days
   * AND no upcoming reservation in the next `thresholdDays` days.
   */
  async detectInactiveStudents(
    operatorId: number,
    thresholdDays: number,
  ): Promise<InactiveStudent[]> {
    const now = new Date();

    const windowStart = new Date(now);
    windowStart.setDate(windowStart.getDate() - thresholdDays);

    const windowEnd = new Date(now);
    windowEnd.setDate(windowEnd.getDate() + thresholdDays);

    // 1. Get all active students
    const users = await this.fspClient.getUsers(operatorId);
    const students = users.filter((u) => u.role === "Student" && u.isActive);

    // 2. Get the schedule for the window
    const schedule = await this.fspClient.getSchedule(operatorId, {
      start: windowStart.toISOString().split("T")[0],
      end: windowEnd.toISOString().split("T")[0],
      locationIds: [],
    });

    const events = schedule.results.events;

    // 3. For each student, check activity
    const inactive: InactiveStudent[] = [];

    for (const student of students) {
      const studentEvents = events.filter(
        (e) => e.CustomerName === student.fullName,
      );

      const pastEvents = studentEvents.filter(
        (e) => new Date(e.Start).getTime() <= now.getTime(),
      );
      const futureEvents = studentEvents.filter(
        (e) => new Date(e.Start).getTime() > now.getTime(),
      );

      const hasPastActivity = pastEvents.length > 0;
      const hasFutureActivity = futureEvents.length > 0;

      if (!hasPastActivity && !hasFutureActivity) {
        const lastFlightDate = this.findLastFlightDate(pastEvents);
        inactive.push({
          studentId: student.id,
          studentName: student.fullName,
          email: student.email,
          lastFlightDate,
          daysSinceLastFlight: lastFlightDate
            ? Math.floor(
                (now.getTime() - lastFlightDate.getTime()) / (1000 * 60 * 60 * 24),
              )
            : null,
        });
      }
    }

    return inactive;
  }

  /** Find the most recent event start date from a list of past events. */
  private findLastFlightDate(pastEvents: FspScheduleEvent[]): Date | null {
    if (pastEvents.length === 0) return null;

    let latest = new Date(pastEvents[0].Start);
    for (const event of pastEvents) {
      const d = new Date(event.Start);
      if (d.getTime() > latest.getTime()) {
        latest = d;
      }
    }
    return latest;
  }
}
