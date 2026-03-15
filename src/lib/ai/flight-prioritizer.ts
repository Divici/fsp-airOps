// ---------------------------------------------------------------------------
// AI Flight Prioritizer — Ranks weather-affected flights by rescheduling urgency
// Uses OpenAI for intelligent ranking with deterministic fallback.
// ---------------------------------------------------------------------------

import { getOpenAIClient } from "./client";
import {
  FLIGHT_PRIORITIZATION_SYSTEM_PROMPT,
  buildFlightPrioritizationPrompt,
} from "./prompts/flight-prioritization";

/** Input: a flight affected by weather, enriched with student context. */
export interface FlightForPrioritization {
  reservationId: string;
  studentId: string;
  studentName: string;
  instructorName: string;
  startTime: string;
  daysSinceLastFlight: number | null;
  trainingStage?: string;
  checkrideDateDays?: number | null;
  totalFlightHours?: number;
}

/** Output: the input flight plus urgency score and AI reasoning. */
export interface PrioritizedFlight extends FlightForPrioritization {
  urgencyScore: number;
  reasoning: string;
}

interface PrioritizationOptions {
  model?: string;
}

interface AIFlightResult {
  reservationId: string;
  urgencyScore: number;
  reasoning: string;
}

/**
 * Prioritize weather-affected flights for rescheduling using AI.
 * Falls back to deterministic scoring if OpenAI is unavailable.
 */
export async function prioritizeFlights(
  flights: FlightForPrioritization[],
  options?: PrioritizationOptions,
): Promise<PrioritizedFlight[]> {
  if (flights.length === 0) return [];

  try {
    return await prioritizeWithAI(flights, options);
  } catch {
    return prioritizeFallback(flights);
  }
}

/**
 * AI-powered prioritization using OpenAI structured output.
 */
async function prioritizeWithAI(
  flights: FlightForPrioritization[],
  options?: PrioritizationOptions,
): Promise<PrioritizedFlight[]> {
  const client = getOpenAIClient();
  const model = options?.model ?? "gpt-4o";
  const prompt = buildFlightPrioritizationPrompt(flights);

  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: FLIGHT_PRIORITIZATION_SYSTEM_PROMPT },
      { role: "user", content: prompt },
    ],
    response_format: { type: "json_object" },
    temperature: 0.2,
    max_tokens: 1000,
  });

  const raw = response.choices[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(raw) as { flights?: AIFlightResult[] };

  if (!Array.isArray(parsed.flights)) {
    throw new Error("Invalid AI response: missing flights array");
  }

  // Build lookup from AI results
  const scoreMap = new Map<string, AIFlightResult>();
  for (const result of parsed.flights) {
    scoreMap.set(result.reservationId, result);
  }

  // Map back to full flight objects, preserving all input data
  const prioritized: PrioritizedFlight[] = flights.map((flight) => {
    const aiResult = scoreMap.get(flight.reservationId);
    return {
      ...flight,
      urgencyScore: aiResult
        ? clampScore(aiResult.urgencyScore)
        : 50,
      reasoning: aiResult?.reasoning ?? "No AI reasoning available.",
    };
  });

  // Sort by urgency descending
  prioritized.sort((a, b) => b.urgencyScore - a.urgencyScore);
  return prioritized;
}

/**
 * Deterministic fallback: sort by daysSinceLastFlight descending,
 * with students who have a checkride within 7 days bumped to top.
 * Assigns linear scores.
 */
export function prioritizeFallback(
  flights: FlightForPrioritization[],
): PrioritizedFlight[] {
  if (flights.length === 0) return [];

  // Separate into checkride-imminent and others
  const checkrideImminent: FlightForPrioritization[] = [];
  const others: FlightForPrioritization[] = [];

  for (const flight of flights) {
    if (
      flight.checkrideDateDays !== null &&
      flight.checkrideDateDays !== undefined &&
      flight.checkrideDateDays <= 7
    ) {
      checkrideImminent.push(flight);
    } else {
      others.push(flight);
    }
  }

  // Sort checkride-imminent by closest checkride first
  checkrideImminent.sort((a, b) => {
    const aDays = a.checkrideDateDays ?? Infinity;
    const bDays = b.checkrideDateDays ?? Infinity;
    return aDays - bDays;
  });

  // Sort others by daysSinceLastFlight descending (most inactive first)
  others.sort((a, b) => {
    const aDays = a.daysSinceLastFlight ?? 0;
    const bDays = b.daysSinceLastFlight ?? 0;
    return bDays - aDays;
  });

  // Combine: checkride-imminent first, then others
  const sorted = [...checkrideImminent, ...others];

  // Assign linear scores: first = 100, last = max(10, 100 - n*step)
  const count = sorted.length;
  const step = count > 1 ? 90 / (count - 1) : 0;

  return sorted.map((flight, i) => {
    const isCheckride =
      flight.checkrideDateDays !== null &&
      flight.checkrideDateDays !== undefined &&
      flight.checkrideDateDays <= 7;

    const score = Math.round(100 - i * step);

    return {
      ...flight,
      urgencyScore: Math.max(10, score),
      reasoning: isCheckride
        ? `Checkride in ${flight.checkrideDateDays} day(s) — highest priority for rescheduling.`
        : flight.daysSinceLastFlight !== null && flight.daysSinceLastFlight > 0
          ? `${flight.daysSinceLastFlight} days since last flight — training gap risk.`
          : "Routine lesson — standard priority.",
    };
  });
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}
