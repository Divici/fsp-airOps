// ---------------------------------------------------------------------------
// ProposalAssembler — Generates human-readable rationale for proposals
// The AI never makes scheduling decisions; it only explains decisions the
// deterministic layer already made.
// ---------------------------------------------------------------------------

import { getOpenAIClient } from "./client";
import { SYSTEM_PROMPT, buildRationalePrompt } from "./prompts/proposal-rationale";
import type { ProposalRationale, RationaleContext } from "./types";

const WORKFLOW_FALLBACK_PREFIX: Record<string, string> = {
  reschedule: "Found alternative time slots based on instructor availability and aircraft compatibility.",
  discovery_flight: "Identified available discovery flight slots matching the requested criteria.",
  next_lesson: "Identified next available training slots based on curriculum progression.",
  waitlist: "Matched waitlisted students to a newly available opening.",
};

/**
 * Validate and normalise a parsed rationale response.
 * Ensures `actionExplanations` length matches the expected action count.
 */
function validateRationale(
  parsed: Record<string, unknown>,
  actionCount: number
): ProposalRationale {
  const summary =
    typeof parsed.summary === "string" && parsed.summary.length > 0
      ? parsed.summary
      : "Scheduling proposal generated.";

  const rationale =
    typeof parsed.rationale === "string" && parsed.rationale.length > 0
      ? parsed.rationale
      : summary;

  let actionExplanations: string[] = [];
  if (Array.isArray(parsed.actionExplanations)) {
    actionExplanations = parsed.actionExplanations.map((e: unknown) =>
      typeof e === "string" ? e : "No explanation available."
    );
  }

  // Pad or trim to match action count
  while (actionExplanations.length < actionCount) {
    actionExplanations.push("No explanation available.");
  }
  actionExplanations = actionExplanations.slice(0, actionCount);

  return { summary, rationale, actionExplanations };
}

export class ProposalAssembler {
  /**
   * Generate a structured rationale for a scheduling proposal using GPT-4o.
   * Falls back to deterministic rationale if the AI call fails.
   */
  async generateRationale(
    context: RationaleContext
  ): Promise<ProposalRationale> {
    try {
      const client = getOpenAIClient();
      const prompt = buildRationalePrompt(context);

      const response = await client.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
        max_tokens: 500,
      });

      const raw = response.choices[0]?.message?.content ?? "{}";
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      return validateRationale(parsed, context.proposedActions.length);
    } catch {
      return this.generateFallbackRationale(context);
    }
  }

  /**
   * Deterministic fallback that generates basic rationale without AI.
   * Ensures proposals are still usable when the AI service is unavailable.
   */
  generateFallbackRationale(context: RationaleContext): ProposalRationale {
    const prefix =
      WORKFLOW_FALLBACK_PREFIX[context.workflowType] ??
      "Scheduling proposal generated.";

    const actionCount = context.proposedActions.length;
    const summary = `${prefix} ${actionCount} option${actionCount === 1 ? "" : "s"} proposed.`;

    const actionExplanations = context.proposedActions.map((action, i) => {
      const time = `${action.startTime.toISOString()} – ${action.endTime.toISOString()}`;
      return `Option ${i + 1}: ${action.actionType} scheduled for ${time}.`;
    });

    return {
      summary,
      rationale: summary,
      actionExplanations,
    };
  }
}
