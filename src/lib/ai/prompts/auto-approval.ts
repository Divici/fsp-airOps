// ---------------------------------------------------------------------------
// Prompt Template — Auto-Approval Risk Assessment
// ---------------------------------------------------------------------------

import type { AutoApprovalContext } from "../types";

export const AUTO_APPROVAL_SYSTEM_PROMPT = `You are an autonomous scheduling risk assessor for a flight school. You receive a scheduling proposal and must decide whether to auto-approve it or defer to human review.

You have tools to investigate the proposal. Call whichever tools are relevant — you don't need to call all of them. Focus on:
- Is the proposed slot still available?
- Does this maintain instructor/aircraft continuity for the student?
- Are there any resource conflicts?
- Is the student at a critical training stage (near checkride)?
- Are weather conditions safe for the flight type?

After investigating, respond with a JSON object:
{
  "decision": "approve" or "defer",
  "confidence": 0.0-1.0,
  "reasoning": "1-3 sentences explaining your decision",
  "riskFactors": ["array of identified risks"],
  "mitigations": ["array of factors that reduce risk"]
}

Guidelines:
- Reschedules with same instructor/aircraft are generally low risk
- Discovery flights for new prospects need more scrutiny (no student history)
- Students near checkrides need schedule continuity — approve quickly
- If weather data shows IFR conditions, defer VFR-only flights
- When in doubt, defer to human review`;

function formatAction(
  action: AutoApprovalContext["proposal"]["actions"][number],
  index: number,
): string {
  const parts = [`Action ${index + 1} (rank ${action.rank}):`];
  parts.push(`  Type: ${action.actionType}`);
  parts.push(
    `  Time: ${action.startTime.toISOString()} – ${action.endTime.toISOString()}`,
  );
  parts.push(`  Location ID: ${action.locationId}`);
  parts.push(`  Student: ${action.studentId}`);
  if (action.instructorId) parts.push(`  Instructor: ${action.instructorId}`);
  if (action.aircraftId) parts.push(`  Aircraft: ${action.aircraftId}`);
  if (action.activityTypeId)
    parts.push(`  Activity type: ${action.activityTypeId}`);
  return parts.join("\n");
}

export function buildUserPrompt(context: AutoApprovalContext): string {
  const sections: string[] = [];

  // Proposal overview
  sections.push(`## Proposal Overview
- ID: ${context.proposal.id}
- Workflow: ${context.proposal.workflowType}
- Priority: ${context.proposal.priority}
- Summary: ${context.proposal.summary}
- Rationale: ${context.proposal.rationale}`);

  // Actions
  const actionLines = context.proposal.actions.map(formatAction);
  sections.push(`## Proposed Actions\n${actionLines.join("\n\n")}`);

  // Trigger info
  sections.push(`## Trigger
- ID: ${context.trigger.id}
- Type: ${context.trigger.type}
- Context: ${context.trigger.context ? JSON.stringify(context.trigger.context) : "none"}`);

  // Operator settings
  sections.push(`## Operator Settings
- Prefer same instructor: ${context.operatorSettings.preferSameInstructor}
- Prefer same aircraft: ${context.operatorSettings.preferSameAircraft}
- Auto-approval threshold: ${context.operatorSettings.autoApprovalThreshold}`);

  // Affected students
  if (
    context.proposal.affectedStudentIds &&
    context.proposal.affectedStudentIds.length > 0
  ) {
    sections.push(
      `## Affected Students\n${context.proposal.affectedStudentIds.join(", ")}`,
    );
  }

  sections.push(
    "Investigate this proposal using the available tools and provide your risk assessment as a JSON object.",
  );

  return sections.join("\n\n");
}
