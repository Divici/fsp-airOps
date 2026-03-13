// ---------------------------------------------------------------------------
// NextLessonResolver — Resolves the next schedulable event from enrollment
// ---------------------------------------------------------------------------

import type { IFspClient } from "@/lib/fsp-client";
import type { FspSchedulableEvent } from "@/lib/types/fsp";

export interface NextLessonResult {
  nextEvent: FspSchedulableEvent;
  enrollmentId: string;
  studentId: string;
}

export class NextLessonResolver {
  constructor(private fspClient: IFspClient) {}

  /**
   * Resolve the next schedulable event for a student's enrollment.
   *
   * - Fetches the student's enrollments and filters to the specified one.
   * - Fetches all schedulable events for the enrollment.
   * - Returns the event with the lowest lessonOrder (next in sequence).
   * - Returns null if enrollment is inactive, not found, or all events completed.
   */
  async getNextLesson(
    operatorId: number,
    studentId: string,
    enrollmentId: string,
  ): Promise<NextLessonResult | null> {
    // 1. Fetch student enrollments and find the target
    const enrollments = await this.fspClient.getEnrollments(
      operatorId,
      studentId,
    );

    const enrollment = enrollments.find(
      (e) => e.enrollmentId === enrollmentId,
    );

    if (!enrollment) {
      return null;
    }

    // Inactive enrollments cannot schedule next lesson
    if (
      enrollment.status !== "Active" &&
      enrollment.status !== "active"
    ) {
      return null;
    }

    // 2. Fetch schedulable events (these are events not yet completed)
    // We use a wide date range since schedulable events represent pending work
    const today = new Date();
    const endDate = new Date(today);
    endDate.setFullYear(endDate.getFullYear() + 1);

    const allEvents = await this.fspClient.getSchedulableEvents(operatorId, {
      startDate: this.formatDate(today),
      endDate: this.formatDate(endDate),
      locationId: 1, // Default location — events are filtered by enrollment below
    });

    // 3. Filter to events for this enrollment
    const enrollmentEvents = allEvents.filter(
      (evt) => evt.enrollmentId === enrollmentId,
    );

    if (enrollmentEvents.length === 0) {
      // All events completed for this enrollment
      return null;
    }

    // 4. Sort by lessonOrder and return the first (next in sequence)
    enrollmentEvents.sort((a, b) => a.lessonOrder - b.lessonOrder);
    const nextEvent = enrollmentEvents[0];

    return {
      nextEvent,
      enrollmentId,
      studentId,
    };
  }

  private formatDate(date: Date): string {
    return date.toISOString().split("T")[0];
  }
}
