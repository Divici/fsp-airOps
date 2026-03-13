// ---------------------------------------------------------------------------
// Discovery Flight Workflow Handler
// Triggered by a prospect request — finds daylight-only slots for a
// discovery flight and proposes the best options.
// ---------------------------------------------------------------------------

import type { IFspClient } from "@/lib/fsp-client";
import type { WorkflowHandler } from "../types";
import type {
  WorkflowContext,
  WorkflowResult,
  ProposalActionInput,
  SlotOption,
} from "@/lib/types/workflow";
import { FindATimeAdapter } from "../scheduling/find-a-time-adapter";
import { rankSlots } from "../scheduling/slot-ranker";
import type { DiscoveryFlightContext } from "./discovery-flight.types";

/** Default discovery flight duration in minutes. */
const DISCOVERY_FLIGHT_DURATION = 60;

/** Default activity type ID for discovery flights. */
const DISCOVERY_FLIGHT_ACTIVITY_TYPE = "at-discovery";

export class DiscoveryFlightWorkflowHandler implements WorkflowHandler {
  type = "discovery_flight" as const;

  constructor(private fspClient: IFspClient) {}

  async execute(context: WorkflowContext): Promise<WorkflowResult> {
    const prospectContext =
      context.trigger.context as DiscoveryFlightContext | null;

    if (!prospectContext) {
      return {
        proposedActions: [],
        summary: "No prospect request context provided",
        rawData: { error: "missing_context" },
      };
    }

    const prospectName = `${prospectContext.firstName} ${prospectContext.lastName}`;

    // Build search window from operator settings or prospect preferences
    const searchStartDate =
      prospectContext.preferredDateStart ?? this.formatDate(new Date());
    const searchEndDate =
      prospectContext.preferredDateEnd ??
      this.formatDate(
        this.addDays(new Date(searchStartDate), context.settings.searchWindowDays)
      );

    // Get civil twilight data for daylight-only constraint
    const locationId = prospectContext.preferredLocationId
      ? String(prospectContext.preferredLocationId)
      : "1";

    const twilight = await this.fspClient.getCivilTwilight(
      context.operatorId,
      locationId
    );

    // Find available slots via FSP
    const adapter = new FindATimeAdapter(this.fspClient);
    const allSlots = await adapter.findSlots({
      operatorId: context.operatorId,
      activityTypeId: DISCOVERY_FLIGHT_ACTIVITY_TYPE,
      startDate: searchStartDate,
      endDate: searchEndDate,
      duration: DISCOVERY_FLIGHT_DURATION,
    });

    // Filter for daylight-only: slots must fall within civil twilight hours
    const daylightSlots = this.filterDaylightSlots(allSlots, twilight);

    // Filter by preferred time windows if provided
    const filteredSlots = prospectContext.preferredTimeWindows?.length
      ? this.filterByTimePreferences(
          daylightSlots,
          prospectContext.preferredTimeWindows
        )
      : daylightSlots;

    // Use filtered slots if any match preferences, otherwise fall back to daylight slots
    const slotsToRank = filteredSlots.length > 0 ? filteredSlots : daylightSlots;

    if (slotsToRank.length === 0) {
      return {
        proposedActions: [],
        summary: `No available discovery flight slots found for ${prospectName}`,
        rawData: {
          prospectContext,
          slotsFound: allSlots.length,
          daylightFiltered: daylightSlots.length,
          preferenceFiltered: filteredSlots.length,
        },
      };
    }

    // Rank slots
    const ranked = rankSlots(slotsToRank, {
      preferSameInstructor: false,
      preferSameInstructorWeight: 0,
      preferSameAircraft: false,
      preferSameAircraftWeight: 0,
    });

    // Take top N from operator settings
    const topN = ranked.slice(0, context.settings.topNAlternatives);

    // Map to proposal actions
    const proposedActions: ProposalActionInput[] = topN.map((slot, i) => ({
      rank: i + 1,
      actionType: "create_reservation" as const,
      startTime: slot.startTime,
      endTime: slot.endTime,
      locationId: slot.locationId,
      studentId: prospectContext.prospectId,
      instructorId: slot.instructorId,
      aircraftId: slot.aircraftId,
      activityTypeId: DISCOVERY_FLIGHT_ACTIVITY_TYPE,
    }));

    return {
      proposedActions,
      summary: `Found ${proposedActions.length} discovery flight slots for ${prospectName}`,
      rawData: {
        prospectContext,
        slotsFound: allSlots.length,
        daylightFiltered: daylightSlots.length,
        preferenceFiltered: filteredSlots.length,
        slotsRanked: ranked.length,
      },
    };
  }

  /**
   * Filter slots to only those that fall entirely within civil twilight hours.
   */
  private filterDaylightSlots(
    slots: SlotOption[],
    twilight: { startDate: string; endDate: string }
  ): SlotOption[] {
    const twilightStart = new Date(twilight.startDate);
    const twilightEnd = new Date(twilight.endDate);

    // Extract hours and minutes for comparison across different dates
    const daylightStartMinutes =
      twilightStart.getHours() * 60 + twilightStart.getMinutes();
    const daylightEndMinutes =
      twilightEnd.getHours() * 60 + twilightEnd.getMinutes();

    return slots.filter((slot) => {
      const slotStartMinutes =
        slot.startTime.getHours() * 60 + slot.startTime.getMinutes();
      const slotEndMinutes =
        slot.endTime.getHours() * 60 + slot.endTime.getMinutes();

      return (
        slotStartMinutes >= daylightStartMinutes &&
        slotEndMinutes <= daylightEndMinutes
      );
    });
  }

  /**
   * Filter slots by preferred time windows (morning/afternoon/evening mapped
   * to hour ranges by the intake form).
   */
  private filterByTimePreferences(
    slots: SlotOption[],
    timeWindows: Array<{ start: string; end: string }>
  ): SlotOption[] {
    return slots.filter((slot) => {
      const slotHour = slot.startTime.getHours();
      return timeWindows.some((window) => {
        const startHour = parseInt(window.start, 10);
        const endHour = parseInt(window.end, 10);
        return slotHour >= startHour && slotHour < endHour;
      });
    });
  }

  private formatDate(date: Date): string {
    return date.toISOString().split("T")[0];
  }

  private addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }
}
