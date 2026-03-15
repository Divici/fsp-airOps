// ---------------------------------------------------------------------------
// Inngest Function — Evaluate Auto-Approval
//
// Background function that evaluates proposals for auto-approval using an
// AI agent with deterministic fallback. Fires after proposal generation.
// ---------------------------------------------------------------------------

import { inngest } from "../client";
import { db } from "@/lib/db";
import { getOperatorSettings } from "@/lib/db/queries/operator-settings";
import {
  getProposalById,
  updateProposalStatus,
} from "@/lib/db/queries/proposals";
import { getTriggerById } from "@/lib/db/queries/triggers";
import { createApprovalDecision } from "@/lib/db/queries/approvals";
import { AutoApprovalAgent } from "@/lib/ai/auto-approval-agent";
import { createFspClient } from "@/lib/fsp-client";
import { ReservationExecutor } from "@/lib/engine/execution/reservation-executor";
import { AuditService } from "@/lib/engine/audit";
import { AUDIT_EVENT_TYPES } from "@/lib/types/audit";
import { sendApprovalNotification } from "@/lib/comms";

export const evaluateAutoApproval = inngest.createFunction(
  { id: "evaluate-auto-approval", retries: 2 },
  { event: "scheduler/proposal.evaluate-auto-approval" },
  async ({ event, step }) => {
    const { proposalId, operatorId, triggerId } = event.data;

    // Step 1: Load settings, check if auto-approval is enabled
    const settings = await step.run("load-settings", async () => {
      return getOperatorSettings(db, operatorId);
    });

    if (!settings.autoApprovalEnabled) {
      return { skipped: true, reason: "auto-approval-disabled" };
    }

    // Step 2: Load proposal + trigger
    const proposalData = await step.run("load-proposal", async () => {
      const proposal = await getProposalById(db, operatorId, proposalId);
      const trigger = await getTriggerById(db, operatorId, triggerId);
      return { proposal, trigger };
    });

    if (!proposalData.proposal) {
      return { skipped: true, reason: "proposal-not-found" };
    }
    if (proposalData.proposal.status !== "pending") {
      return { skipped: true, reason: "already-acted" };
    }

    // Step 3: Run AI agent evaluation
    // Note: Inngest step.run() JSON-serializes return values, so Date fields
    // become strings. We must reconstruct Date objects for the AI context.
    const decision = await step.run("evaluate-risk", async () => {
      const fspClient = createFspClient();
      const agent = new AutoApprovalAgent(fspClient);
      const p = proposalData.proposal!;
      return agent.evaluate({
        proposal: {
          ...p,
          actions: p.actions.map((a) => ({
            ...a,
            startTime: new Date(a.startTime),
            endTime: new Date(a.endTime),
          })),
        },
        trigger: {
          id: triggerId,
          type: proposalData.trigger?.type ?? "unknown",
          context:
            (proposalData.trigger?.context as Record<string, unknown>) ?? null,
        },
        operatorSettings: {
          preferSameInstructor: settings.preferSameInstructor,
          preferSameAircraft: settings.preferSameAircraft,
          autoApprovalThreshold: settings.autoApprovalThreshold,
        },
        operatorId,
      });
    });

    // Step 4: Store assessment in validationSnapshot (always, even if deferred)
    await step.run("store-assessment", async () => {
      const { proposals } = await import("@/lib/db/schema");
      const { eq } = await import("drizzle-orm");
      await db
        .update(proposals)
        .set({
          validationSnapshot: {
            autoApproved:
              decision.decision === "approve" &&
              decision.confidence >= settings.autoApprovalThreshold,
            decision: {
              decision: decision.decision,
              confidence: decision.confidence,
              reasoning: decision.reasoning,
              riskFactors: decision.riskFactors,
              mitigations: decision.mitigations,
              method: decision.method,
            },
            toolCalls: decision.toolCalls,
            threshold: settings.autoApprovalThreshold,
            evaluatedAt: new Date().toISOString(),
          },
        })
        .where(eq(proposals.id, proposalId));

      // Log risk assessment audit event
      const audit = new AuditService(db);
      await audit.logEvent(operatorId, AUDIT_EVENT_TYPES.RISK_ASSESSED, {
        entityId: proposalId,
        entityType: "proposal",
        payload: {
          riskScore: decision.confidence,
          method: decision.method,
          decision: decision.decision,
        },
      });
    });

    // Step 5: Auto-approve if decision is approve + confidence meets threshold
    if (
      decision.decision === "approve" &&
      decision.confidence >= settings.autoApprovalThreshold
    ) {
      const executionResult = await step.run(
        "auto-approve-and-execute",
        async () => {
          // Guard: re-check proposal is still pending (human may have acted)
          const currentProposal = await getProposalById(
            db,
            operatorId,
            proposalId,
          );
          if (!currentProposal || currentProposal.status !== "pending") {
            return { skipped: true, reason: "status-changed" };
          }

          // Approve
          await updateProposalStatus(db, operatorId, proposalId, "approved");
          await createApprovalDecision(db, {
            proposalId,
            operatorId,
            decidedByUserId: "system:auto-approver",
            decision: "approved",
            notes: decision.reasoning,
          });

          // Execute
          const fspClient = createFspClient();
          const audit = new AuditService(db);
          const executor = new ReservationExecutor(db, fspClient, audit);
          const result = await executor.executeProposal(operatorId, proposalId);

          // Log auto-approval audit event
          await audit.logEvent(
            operatorId,
            AUDIT_EVENT_TYPES.PROPOSAL_AUTO_APPROVED,
            {
              entityId: proposalId,
              entityType: "proposal",
              payload: {
                confidence: decision.confidence,
                threshold: settings.autoApprovalThreshold,
                reasoning: decision.reasoning,
                executionSuccess: result.success,
              },
            },
          );

          // Handle discovery prospect status advancement
          if (
            proposalData.proposal!.workflowType === "discovery_flight" &&
            proposalData.proposal!.triggerId
          ) {
            try {
              const { schedulingTriggers } = await import("@/lib/db/schema");
              const { eq } = await import("drizzle-orm");
              const { updateProspectStatus } = await import(
                "@/lib/db/queries/prospects"
              );

              const trigger = await db
                .select()
                .from(schedulingTriggers)
                .where(
                  eq(
                    schedulingTriggers.id,
                    proposalData.proposal!.triggerId!,
                  ),
                )
                .limit(1);

              const prospectId = trigger[0]?.sourceEntityId;
              if (
                prospectId &&
                trigger[0]?.sourceEntityType === "prospect_request"
              ) {
                await updateProspectStatus(
                  db,
                  operatorId,
                  prospectId,
                  "approved",
                );
                if (result.success) {
                  await updateProspectStatus(
                    db,
                    operatorId,
                    prospectId,
                    "booked",
                  );
                }
              }
            } catch {
              // Non-critical
            }
          }

          return { executed: true, success: result.success };
        },
      );

      // Step 6: Send notification (trackable via Inngest step)
      await step.run("send-notification", async () => {
        if (
          executionResult &&
          "executed" in executionResult &&
          executionResult.executed
        ) {
          // Re-fetch the proposal to get proper Date types (Inngest serializes)
          const freshProposal = await getProposalById(db, operatorId, proposalId);
          if (freshProposal) {
            await sendApprovalNotification({
              db,
              operatorId,
              proposal: freshProposal,
              executionSuccess: Boolean(executionResult.success),
            });
          }
        }
      });

      return {
        decision: "approve",
        confidence: decision.confidence,
        execution: executionResult,
      };
    } else {
      // Log deferral
      await step.run("log-deferral", async () => {
        const audit = new AuditService(db);
        await audit.logEvent(
          operatorId,
          AUDIT_EVENT_TYPES.PROPOSAL_AUTO_DEFERRED,
          {
            entityId: proposalId,
            entityType: "proposal",
            payload: {
              confidence: decision.confidence,
              threshold: settings.autoApprovalThreshold,
              reasoning: decision.reasoning,
              riskFactors: decision.riskFactors,
            },
          },
        );
      });

      return {
        decision: "defer",
        confidence: decision.confidence,
        reasoning: decision.reasoning,
      };
    }
  },
);
