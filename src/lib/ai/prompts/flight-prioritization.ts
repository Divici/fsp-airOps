// ---------------------------------------------------------------------------
// Prompt Template — Flight Prioritization for Weather Disruptions
// ---------------------------------------------------------------------------

export const FLIGHT_PRIORITIZATION_SYSTEM_PROMPT = `You are a flight school scheduling assistant evaluating which weather-affected flights should be prioritized for rescheduling. Consider these factors in order of importance:

1. **Checkride proximity** (highest priority): Students with upcoming checkrides in the next 7 days need consistent training. Missing a lesson close to a checkride can jeopardize months of preparation.

2. **Training gaps**: Students who haven't flown recently (high daysSinceLastFlight) lose proficiency quickly, especially early in training. Prioritize students with the longest gaps.

3. **Training stage progression**: Students in advanced stages (pre-solo, pre-checkride) benefit more from consistent scheduling than students in early stages.

4. **Total experience level**: Lower-hour students are more affected by disruptions because they have less ingrained muscle memory.

Respond with a JSON object containing exactly one field:
- "flights": An array of objects, one per input flight, each with:
  - "reservationId": string (matching the input)
  - "urgencyScore": number 0-100 (100 = most urgent to reschedule)
  - "reasoning": string (one sentence explaining why this flight has this urgency)

Sort the array by urgencyScore descending (most urgent first).`;

export function buildFlightPrioritizationPrompt(
  flights: Array<{
    reservationId: string;
    studentName: string;
    startTime: string;
    daysSinceLastFlight: number | null;
    trainingStage?: string;
    checkrideDateDays?: number | null;
    totalFlightHours?: number;
  }>,
): string {
  const flightDescriptions = flights.map((f, i) => {
    const parts = [`Flight ${i + 1} (${f.reservationId}):`];
    parts.push(`  Student: ${f.studentName}`);
    parts.push(`  Scheduled: ${f.startTime}`);
    parts.push(
      `  Days since last flight: ${f.daysSinceLastFlight !== null ? f.daysSinceLastFlight : "unknown"}`,
    );
    if (f.trainingStage) parts.push(`  Training stage: ${f.trainingStage}`);
    if (f.checkrideDateDays !== undefined && f.checkrideDateDays !== null) {
      parts.push(`  Days until checkride: ${f.checkrideDateDays}`);
    }
    if (f.totalFlightHours !== undefined) {
      parts.push(`  Total flight hours: ${f.totalFlightHours}`);
    }
    return parts.join("\n");
  });

  return [
    `## Weather-Affected Flights to Prioritize`,
    ``,
    `The following ${flights.length} flight(s) are affected by weather and need rescheduling. Rank them by urgency.`,
    ``,
    ...flightDescriptions,
    ``,
    `Respond with a JSON object containing a "flights" array with urgencyScore (0-100) and reasoning for each flight, sorted by urgencyScore descending.`,
  ].join("\n");
}
