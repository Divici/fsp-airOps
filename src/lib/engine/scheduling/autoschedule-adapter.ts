// ---------------------------------------------------------------------------
// AutoScheduleAdapter — Wraps the FSP AutoSchedule API for workflow use
// ---------------------------------------------------------------------------

import type { IFspClient } from "@/lib/fsp-client";
import type {
  FspAutoSchedulePayload,
  FspAutoScheduleEvent,
} from "@/lib/types/fsp";
import type { SlotOption } from "@/lib/types/workflow";

export class AutoScheduleAdapter {
  constructor(private fspClient: IFspClient) {}

  /**
   * Run AutoSchedule for the given events and convert results to SlotOptions.
   * AutoSchedule returns UTC times — this adapter converts to local using
   * the timeZoneOffset from the payload config.
   */
  async schedule(
    operatorId: number,
    payload: FspAutoSchedulePayload,
  ): Promise<SlotOption[]> {
    const result = await this.fspClient.autoSchedule(operatorId, payload);

    return result.scheduledEvents.map((evt: FspAutoScheduleEvent) => {
      const startUtc = new Date(evt.startUtc);
      const endUtc = new Date(evt.endUtc);

      // Convert UTC to local by applying the timezone offset (in minutes)
      const offsetMs = payload.config.timeZoneOffset * 60 * 1000;
      const startLocal = new Date(startUtc.getTime() + offsetMs);
      const endLocal = new Date(endUtc.getTime() + offsetMs);

      return {
        startTime: startLocal,
        endTime: endLocal,
        instructorId: evt.instructorId,
        aircraftId: evt.aircraftId,
        locationId: payload.config.locationId,
        score: 50, // Default mid-range score for auto-scheduled slots
      };
    });
  }
}
