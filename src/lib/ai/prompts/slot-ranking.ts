// ---------------------------------------------------------------------------
// Prompt Template — AI Slot Ranking
// ---------------------------------------------------------------------------

import type { SlotOption } from "@/lib/types/workflow";
import type { StudentHistory } from "../slot-ranker";

export const SLOT_RANKING_SYSTEM_PROMPT = `You are a scheduling assistant for a flight school. Rank these candidate time slots for a student based on their historical preferences and training needs.

Consider these factors:
- Instructor continuity: students learn better with consistent instructors
- Time-of-day patterns: students tend to prefer times they have flown before
- Day-of-week patterns: students often have recurring weekly availability
- Recency: if a student hasn't flown in a while, prioritize sooner slots

Respond with a JSON object:
{
  "rankedIndices": [0, 2, 1],
  "reasons": ["Best match: same instructor and preferred morning time", "Good alternative: preferred day of week", "Available but different instructor"]
}

Where rankedIndices is an array of slot indices (0-based) ordered from most preferred to least preferred, and reasons is a parallel array with a brief reason for each ranking.`;

function formatSlot(slot: SlotOption, index: number): string {
  const parts = [`Slot ${index}:`];
  parts.push(`  Time: ${slot.startTime.toISOString()} – ${slot.endTime.toISOString()}`);
  parts.push(`  Day: ${slot.startTime.toLocaleDateString("en-US", { weekday: "long" })}`);
  parts.push(`  Location ID: ${slot.locationId}`);
  if (slot.instructorId) parts.push(`  Instructor: ${slot.instructorId}`);
  if (slot.aircraftId) parts.push(`  Aircraft: ${slot.aircraftId}`);
  parts.push(`  Score: ${slot.score}`);
  return parts.join("\n");
}

export function buildSlotRankingPrompt(
  slots: SlotOption[],
  history: StudentHistory,
): string {
  const sections: string[] = [];

  // Student profile
  sections.push(`## Student Profile
- Name: ${history.studentName}
- Days since last flight: ${history.daysSinceLastFlight}${history.preferredInstructorId ? `\n- Preferred instructor: ${history.preferredInstructorId}` : ""}`);

  // Recent booking patterns
  if (history.recentBookings.length > 0) {
    const bookingLines = history.recentBookings.map(
      (b) => `  - ${b.dayOfWeek} ${b.timeOfDay} with instructor ${b.instructorId}`,
    );
    sections.push(`## Recent Booking Patterns\n${bookingLines.join("\n")}`);
  } else {
    sections.push("## Recent Booking Patterns\nNo recent bookings.");
  }

  // Candidate slots
  const slotLines = slots.map(formatSlot);
  sections.push(`## Candidate Slots\n${slotLines.join("\n\n")}`);

  sections.push(
    `Rank all ${slots.length} slots by preference for this student. Return JSON with "rankedIndices" and "reasons".`,
  );

  return sections.join("\n\n");
}
