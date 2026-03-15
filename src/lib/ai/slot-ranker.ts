// ---------------------------------------------------------------------------
// AI Slot Ranker — Reranks candidate slots using student history via OpenAI
// Falls back to original ordering if AI is unavailable.
// ---------------------------------------------------------------------------

import type { SlotOption } from "@/lib/types/workflow";
import { getOpenAIClient } from "./client";
import {
  SLOT_RANKING_SYSTEM_PROMPT,
  buildSlotRankingPrompt,
} from "./prompts/slot-ranking";

export interface StudentHistory {
  studentId: string;
  studentName: string;
  recentBookings: Array<{
    dayOfWeek: string;
    timeOfDay: string;
    instructorId: string;
  }>;
  preferredInstructorId?: string;
  daysSinceLastFlight: number;
}

interface SlotRankingResponse {
  rankedIndices: number[];
  reasons: string[];
}

/**
 * Rank candidate slots using AI based on student history and preferences.
 *
 * If OpenAI is unavailable (no API key, timeout, error), returns the slots
 * in their original order — the deterministic ranker upstream already
 * provides a reasonable ordering.
 */
export async function rankSlotsWithAI(
  slots: SlotOption[],
  studentHistory: StudentHistory,
  options?: { model?: string },
): Promise<SlotOption[]> {
  if (slots.length <= 1) {
    return slots;
  }

  try {
    if (!process.env.OPENAI_API_KEY) {
      return slots;
    }

    const client = getOpenAIClient();
    const prompt = buildSlotRankingPrompt(slots, studentHistory);
    const model = options?.model ?? "gpt-4o";

    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: SLOT_RANKING_SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
      max_tokens: 300,
    });

    const raw = response.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw) as SlotRankingResponse;

    return applyRanking(slots, parsed);
  } catch {
    // Fallback: return slots in original deterministic order
    return slots;
  }
}

/**
 * Reorder slots based on AI-provided ranking indices.
 * Validates indices and falls back to original order on invalid data.
 */
function applyRanking(
  slots: SlotOption[],
  ranking: SlotRankingResponse,
): SlotOption[] {
  if (
    !Array.isArray(ranking.rankedIndices) ||
    ranking.rankedIndices.length === 0
  ) {
    return slots;
  }

  // Validate all indices are within bounds and unique
  const seen = new Set<number>();
  for (const idx of ranking.rankedIndices) {
    if (typeof idx !== "number" || idx < 0 || idx >= slots.length || seen.has(idx)) {
      return slots;
    }
    seen.add(idx);
  }

  // Build reordered array — include any missing indices at the end
  const reordered: SlotOption[] = ranking.rankedIndices.map((idx) => slots[idx]);

  // Append any slots not mentioned in the ranking
  for (let i = 0; i < slots.length; i++) {
    if (!seen.has(i)) {
      reordered.push(slots[i]);
    }
  }

  return reordered;
}
