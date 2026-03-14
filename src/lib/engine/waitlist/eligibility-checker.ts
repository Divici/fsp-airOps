// ---------------------------------------------------------------------------
// EligibilityChecker — Validates whether a student is eligible for a slot
// ---------------------------------------------------------------------------

import type { IFspClient } from "@/lib/fsp-client";
import type { FspEnrollment, FspReservationListItem } from "@/lib/types/fsp";
import type { EligibilityResult } from "./types";

export class EligibilityChecker {
  constructor(private fspClient: IFspClient) {}

  /**
   * Check if a student is eligible for a specific time slot.
   *
   * Validates:
   * 1. Student has at least one active enrollment
   * 2. Student does not have a conflicting reservation in the time window
   */
  async checkEligibility(
    operatorId: number,
    studentId: string,
    slotStart: Date,
    slotEnd: Date,
  ): Promise<EligibilityResult> {
    // 1. Check active enrollment
    const enrollments = await this.fspClient.getEnrollments(
      operatorId,
      studentId,
    );
    const hasActiveEnrollment = enrollments.some(
      (e: FspEnrollment) => e.status === "Active",
    );

    if (!hasActiveEnrollment) {
      return { eligible: false, reason: "No active enrollment" };
    }

    // 2. Check for conflicting reservations
    const dateStr = (d: Date) => d.toISOString().split("T")[0];
    const reservations = await this.fspClient.listReservations(operatorId, {
      start: dateStr(slotStart),
      end: dateStr(slotEnd),
    });

    const hasConflict = reservations.some((r: FspReservationListItem) => {
      if (r.pilotId !== studentId) return false;
      const rStart = new Date(r.start);
      const rEnd = new Date(r.end);
      // Overlaps if one starts before the other ends and vice versa
      return rStart.getTime() < slotEnd.getTime() &&
        rEnd.getTime() > slotStart.getTime();
    });

    if (hasConflict) {
      return { eligible: false, reason: "Conflicting reservation" };
    }

    return { eligible: true };
  }
}
