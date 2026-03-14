// ---------------------------------------------------------------------------
// Signal Computation — Functions for computing waitlist ranking signals
// ---------------------------------------------------------------------------

import type { FspScheduleResponse } from "@/lib/types/fsp";

/**
 * Compute hours since the student's last completed flight.
 * Searches schedule events for the given student name and returns
 * hours between the most recent past event end and `now`.
 */
export function computeTimeSinceLastFlight(
  schedule: FspScheduleResponse,
  studentName: string,
  now: Date = new Date(),
): number {
  const studentEvents = schedule.results.events
    .filter((e) => e.CustomerName === studentName)
    .map((e) => new Date(e.End))
    .filter((d) => d.getTime() <= now.getTime())
    .sort((a, b) => b.getTime() - a.getTime());

  if (studentEvents.length === 0) {
    // No past flights — return a large number to indicate long gap
    return Infinity;
  }

  return (now.getTime() - studentEvents[0].getTime()) / (1000 * 60 * 60);
}

/**
 * Compute hours until the student's next scheduled flight.
 * Returns Infinity if no future flight is scheduled.
 */
export function computeTimeUntilNextFlight(
  schedule: FspScheduleResponse,
  studentName: string,
  now: Date = new Date(),
): number {
  const futureEvents = schedule.results.events
    .filter((e) => e.CustomerName === studentName)
    .map((e) => new Date(e.Start))
    .filter((d) => d.getTime() > now.getTime())
    .sort((a, b) => a.getTime() - b.getTime());

  if (futureEvents.length === 0) {
    return Infinity;
  }

  return (futureEvents[0].getTime() - now.getTime()) / (1000 * 60 * 60);
}

/**
 * Compute total logged flight hours from enrollment progress.
 */
export function computeTotalHours(completedFlightHours: number): number {
  return completedFlightHours;
}

/**
 * Compute instructor continuity: 1 if the slot instructor matches
 * the student's last instructor, 0 otherwise.
 */
export function computeInstructorContinuity(
  lastInstructorId: string | undefined,
  slotInstructorId: string | undefined,
): number {
  if (!lastInstructorId || !slotInstructorId) return 0;
  return lastInstructorId === slotInstructorId ? 1 : 0;
}

/**
 * Compute aircraft familiarity: 1 if the student has flown the aircraft
 * before (appears in their reservation history), 0 otherwise.
 */
export function computeAircraftFamiliarity(
  studentAircraftHistory: string[],
  aircraftId: string | undefined,
): number {
  if (!aircraftId) return 0;
  return studentAircraftHistory.includes(aircraftId) ? 1 : 0;
}

/**
 * Normalize a value to [0, 1] given a min and max range.
 * Values outside the range are clamped.
 */
export function normalizeSignal(
  value: number,
  min: number,
  max: number,
): number {
  if (max === min) return 0.5;
  if (!isFinite(value)) {
    // Treat Infinity as max
    return 1;
  }
  const normalized = (value - min) / (max - min);
  return Math.max(0, Math.min(1, normalized));
}
