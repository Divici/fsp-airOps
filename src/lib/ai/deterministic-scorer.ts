// ---------------------------------------------------------------------------
// Deterministic Scorer — Fallback risk assessment without AI dependency
// ---------------------------------------------------------------------------

import type { AutoApprovalContext, AutoApprovalDecision } from "./types";

const WORKFLOW_RISK: Record<string, number> = {
  reschedule: 0.05,
  next_lesson: 0.1,
  waitlist: 0.15,
  discovery_flight: 0.3,
};

/**
 * Computes a deterministic auto-approval decision based on proposal attributes.
 * Used as a fallback when the AI agent is unavailable or exceeds iteration limits.
 */
export function computeDeterministicScore(
  context: AutoApprovalContext,
): AutoApprovalDecision {
  let riskScore = 0;
  const riskFactors: string[] = [];
  const mitigations: string[] = [];

  // 1. Workflow type base risk
  const baseRisk = WORKFLOW_RISK[context.proposal.workflowType] ?? 0.2;
  riskScore += baseRisk;
  if (baseRisk >= 0.2) {
    riskFactors.push(
      `Higher-risk workflow type: ${context.proposal.workflowType}`,
    );
  } else {
    mitigations.push(
      `Low-risk workflow type: ${context.proposal.workflowType}`,
    );
  }

  // 2. Multiple actions increase complexity
  if (context.proposal.actions.length > 1) {
    riskScore += 0.05;
    riskFactors.push(
      `Multiple actions in proposal (${context.proposal.actions.length})`,
    );
  }

  // 3. Missing instructor or aircraft
  for (const action of context.proposal.actions) {
    if (!action.instructorId) {
      riskScore += 0.1;
      riskFactors.push("Action missing instructor assignment");
      break;
    }
  }
  for (const action of context.proposal.actions) {
    if (!action.aircraftId) {
      riskScore += 0.1;
      riskFactors.push("Action missing aircraft assignment");
      break;
    }
  }

  // 4. High priority proposals get a small mitigation
  if (context.proposal.priority >= 8) {
    riskScore -= 0.05;
    mitigations.push(`High priority proposal (${context.proposal.priority})`);
  }

  // 5. Operator preferences as signals
  if (context.operatorSettings.preferSameInstructor) {
    mitigations.push("Operator prefers instructor continuity");
  }
  if (context.operatorSettings.preferSameAircraft) {
    mitigations.push("Operator prefers aircraft continuity");
  }

  // Clamp confidence between 0 and 1
  const confidence = Math.max(0, Math.min(1, 1 - riskScore));
  const threshold = context.operatorSettings.autoApprovalThreshold;
  const decision = confidence >= threshold ? "approve" : "defer";

  return {
    decision,
    confidence,
    reasoning: `Deterministic assessment: ${decision === "approve" ? "Low" : "Elevated"} risk based on ${context.proposal.workflowType} workflow type. Confidence ${(confidence * 100).toFixed(0)}% vs threshold ${(threshold * 100).toFixed(0)}%.`,
    riskFactors,
    mitigations,
    toolCalls: [],
    method: "deterministic",
  };
}
