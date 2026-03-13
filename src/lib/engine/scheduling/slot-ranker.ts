// ---------------------------------------------------------------------------
// Slot Ranker — Ranks slot options based on operator preferences
// ---------------------------------------------------------------------------

import type { SlotOption } from "@/lib/types/workflow";

export interface SlotRankingCriteria {
  preferSameInstructor: boolean;
  preferSameInstructorWeight: number;
  preferredInstructorId?: string;
  preferSameAircraft: boolean;
  preferSameAircraftWeight: number;
  preferredAircraftId?: string;
  /** Original start hour (0-23) for time-of-day proximity scoring. */
  originalStartHour?: number;
}

/**
 * Score and rank slot options.
 *
 * Scoring:
 * - Base score: normalized from the slot's existing score (divided by 100, clamped to 0-1).
 *   Falls back to 0.5 if no score provided.
 * - Instructor bonus: +weight if slot instructor matches the preferred instructor.
 * - Aircraft bonus: +weight if slot aircraft matches the preferred aircraft.
 * - Time-of-day bonus: up to +0.2 for slots closer to the original time of day.
 *
 * Returns a new array sorted by score descending.
 */
export function rankSlots(
  slots: SlotOption[],
  criteria: SlotRankingCriteria,
): SlotOption[] {
  const scored = slots.map((slot) => {
    let score = slot.score ? Math.min(slot.score / 100, 1) : 0.5;

    // Instructor preference bonus
    if (
      criteria.preferSameInstructor &&
      criteria.preferredInstructorId &&
      slot.instructorId === criteria.preferredInstructorId
    ) {
      score += criteria.preferSameInstructorWeight;
    }

    // Aircraft preference bonus
    if (
      criteria.preferSameAircraft &&
      criteria.preferredAircraftId &&
      slot.aircraftId === criteria.preferredAircraftId
    ) {
      score += criteria.preferSameAircraftWeight;
    }

    // Time-of-day proximity bonus (max +0.2)
    if (criteria.originalStartHour !== undefined) {
      const slotHour = slot.startTime.getHours();
      const hourDiff = Math.abs(slotHour - criteria.originalStartHour);
      // Max bonus at 0 diff, linearly decays over 12 hours
      const timeBonus = Math.max(0, 0.2 * (1 - hourDiff / 12));
      score += timeBonus;
    }

    return { slot, score };
  });

  scored.sort((a, b) => b.score - a.score);

  return scored.map(({ slot, score }) => ({
    ...slot,
    score: Math.round(score * 100) / 100,
  }));
}
