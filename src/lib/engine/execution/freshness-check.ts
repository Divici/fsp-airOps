// ---------------------------------------------------------------------------
// Freshness Checker — Verify slot availability before reservation creation
// ---------------------------------------------------------------------------

import type { IFspClient, ScheduleQueryParams } from "@/lib/fsp-client/types";

export interface FreshnessCheckParams {
  operatorId: number;
  startTime: Date;
  endTime: Date;
  instructorId?: string | null;
  aircraftId?: string | null;
  locationId: number;
}

export interface FreshnessCheckResult {
  available: boolean;
  reason?: string;
}

/**
 * Re-checks that a slot is still available by querying the FSP schedule.
 * Guards against stale proposals where the slot was taken between proposal
 * generation and execution.
 */
export class FreshnessChecker {
  constructor(private fspClient: IFspClient) {}

  async checkSlotAvailable(
    params: FreshnessCheckParams
  ): Promise<FreshnessCheckResult> {
    const { operatorId, startTime, endTime, instructorId, aircraftId, locationId } =
      params;

    const queryParams: ScheduleQueryParams = {
      start: startTime.toISOString(),
      end: endTime.toISOString(),
      locationIds: [locationId],
    };

    const schedule = await this.fspClient.getSchedule(operatorId, queryParams);
    const events = schedule.results.events;

    // Check for overlapping events that use the same instructor or aircraft
    for (const event of events) {
      const eventStart = new Date(event.Start);
      const eventEnd = new Date(event.End);

      const overlaps = eventStart < endTime && eventEnd > startTime;
      if (!overlaps) continue;

      if (
        aircraftId &&
        event.AircraftName &&
        event.AircraftName.includes(aircraftId)
      ) {
        return {
          available: false,
          reason: `Aircraft ${aircraftId} is already booked from ${event.Start} to ${event.End}`,
        };
      }

      if (
        instructorId &&
        event.InstructorName &&
        event.InstructorName.includes(instructorId)
      ) {
        return {
          available: false,
          reason: `Instructor ${instructorId} is already booked from ${event.Start} to ${event.End}`,
        };
      }
    }

    return { available: true };
  }
}
