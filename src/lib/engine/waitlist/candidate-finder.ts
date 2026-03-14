// ---------------------------------------------------------------------------
// CandidateFinder — Finds students eligible for a waitlist opening
// ---------------------------------------------------------------------------

import type { IFspClient } from "@/lib/fsp-client";
import type { FspSchedulableEvent } from "@/lib/types/fsp";
import type { OpeningConstraints, WaitlistCandidate, WaitlistSignals } from "./types";
import {
  computeTimeSinceLastFlight,
  computeTimeUntilNextFlight,
  computeTotalHours,
  computeInstructorContinuity,
  computeAircraftFamiliarity,
} from "./signals";

export class CandidateFinder {
  constructor(private fspClient: IFspClient) {}

  /**
   * Find students with pending schedulable events that match the opening
   * constraints, filter by eligibility, and return with computed signals.
   */
  async findCandidates(
    operatorId: number,
    constraints: OpeningConstraints,
  ): Promise<WaitlistCandidate[]> {
    // 1. Get schedulable events in the time window
    const dateStr = (d: Date) => d.toISOString().split("T")[0];
    const events = await this.fspClient.getSchedulableEvents(operatorId, {
      startDate: dateStr(constraints.timeWindow.start),
      endDate: dateStr(constraints.timeWindow.end),
      locationId: constraints.locationId,
    });

    // 2. Filter by activity type if specified
    let filtered = events;
    if (constraints.activityTypeId) {
      filtered = filtered.filter(
        (e) => e.activityTypeId === constraints.activityTypeId,
      );
    }

    // 3. Deduplicate by student (take first/next event per student)
    const byStudent = new Map<string, FspSchedulableEvent>();
    for (const evt of filtered) {
      if (!byStudent.has(evt.studentId)) {
        byStudent.set(evt.studentId, evt);
      }
    }

    // 4. Get schedule for signal computation
    const schedule = await this.fspClient.getSchedule(operatorId, {
      start: dateStr(constraints.timeWindow.start),
      end: dateStr(constraints.timeWindow.end),
      locationIds: [constraints.locationId],
    });

    // 5. Get reservations for aircraft familiarity
    const reservations = await this.fspClient.listReservations(operatorId, {
      start: dateStr(constraints.timeWindow.start),
      end: dateStr(constraints.timeWindow.end),
    });

    // 6. Check enrollment eligibility and build candidates
    //    Note: slot-level conflict checks happen later when specific slots are found
    const candidates: WaitlistCandidate[] = [];
    const now = new Date();

    for (const [studentId, evt] of byStudent) {
      // Check active enrollment (requirement for waitlist eligibility)
      const enrollments = await this.fspClient.getEnrollments(
        operatorId,
        studentId,
      );
      const activeEnrollment = enrollments.find((e) => e.status === "Active");

      if (!activeEnrollment) continue;
      let totalHours = 0;
      if (activeEnrollment) {
        try {
          const progress = await this.fspClient.getEnrollmentProgress(
            operatorId,
            activeEnrollment.enrollmentId,
          );
          totalHours = computeTotalHours(progress.completedFlightHours);
        } catch {
          // Progress not available — use 0
        }
      }

      // Build aircraft history from reservations
      const studentReservations = reservations.filter(
        (r) => r.pilotId === studentId,
      );
      const aircraftHistory = studentReservations.map((r) => r.resource);

      const studentName = `${evt.studentFirstName} ${evt.studentLastName}`;

      const signals: WaitlistSignals = {
        timeSinceLastFlight: computeTimeSinceLastFlight(
          schedule,
          studentName,
          now,
        ),
        timeUntilNextFlight: computeTimeUntilNextFlight(
          schedule,
          studentName,
          now,
        ),
        totalHours,
        instructorContinuity: computeInstructorContinuity(
          evt.instructorIds[0],
          undefined, // Will be filled during ranking with actual slot instructor
        ),
        aircraftFamiliarity: computeAircraftFamiliarity(
          aircraftHistory,
          constraints.aircraftType,
        ),
      };

      candidates.push({
        studentId,
        studentName,
        enrollmentId: activeEnrollment?.enrollmentId ?? evt.enrollmentId,
        nextEventId: evt.eventId,
        eligibilityScore: 0, // Will be set by ranker
        signals,
      });
    }

    return candidates;
  }
}
