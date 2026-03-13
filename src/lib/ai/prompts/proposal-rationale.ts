// ---------------------------------------------------------------------------
// Prompt Template — Proposal Rationale Generation
// ---------------------------------------------------------------------------

import type { RationaleContext } from "../types";

export const SYSTEM_PROMPT = `You are a scheduling assistant for a flight school. Generate concise, professional explanations for scheduling proposals. Your audience is experienced dispatchers/schedulers. Be factual and specific — mention times, names, and resource details. Do not use marketing language or be overly enthusiastic.

Respond with a JSON object containing exactly these fields:
- "summary": A single sentence summarizing the proposal.
- "rationale": 2-4 sentences explaining why these options were selected.
- "actionExplanations": An array of strings, one per proposed action, each explaining that specific action.`;

const WORKFLOW_LABELS: Record<string, string> = {
  reschedule:
    "A reservation was cancelled and the system found alternative time slots.",
  discovery_flight:
    "A prospective student requested a discovery flight and available slots were identified.",
  next_lesson:
    "A student completed a lesson and the system identified the next available training slots.",
  waitlist:
    "An opening was detected and waitlisted students may be able to fill it.",
};

function formatAction(
  action: RationaleContext["proposedActions"][number],
  index: number
): string {
  const parts = [`Option ${index + 1} (rank ${action.rank}):`];
  parts.push(`  Time: ${action.startTime.toISOString()} – ${action.endTime.toISOString()}`);
  parts.push(`  Type: ${action.actionType}`);
  parts.push(`  Student: ${action.studentId}`);
  if (action.instructorId) parts.push(`  Instructor: ${action.instructorId}`);
  if (action.aircraftId) parts.push(`  Aircraft: ${action.aircraftId}`);
  if (action.activityTypeId)
    parts.push(`  Activity type: ${action.activityTypeId}`);
  if (action.explanation) parts.push(`  Note: ${action.explanation}`);
  return parts.join("\n");
}

export function buildRationalePrompt(context: RationaleContext): string {
  const sections: string[] = [];

  // Workflow context
  const label =
    WORKFLOW_LABELS[context.workflowType] ?? `Workflow: ${context.workflowType}`;
  sections.push(`## Context\n${label}`);

  // Trigger details
  if (Object.keys(context.triggerContext).length > 0) {
    sections.push(
      `## Trigger Details\n${JSON.stringify(context.triggerContext, null, 2)}`
    );
  }

  // Proposed actions
  const actionLines = context.proposedActions.map(formatAction);
  sections.push(`## Proposed Actions\n${actionLines.join("\n\n")}`);

  // Additional context
  if (
    context.additionalContext &&
    Object.keys(context.additionalContext).length > 0
  ) {
    sections.push(
      `## Additional Context\n${JSON.stringify(context.additionalContext, null, 2)}`
    );
  }

  sections.push(
    `Provide a JSON response with "summary", "rationale", and "actionExplanations" (one explanation per proposed action, ${context.proposedActions.length} total).`
  );

  return sections.join("\n\n");
}
