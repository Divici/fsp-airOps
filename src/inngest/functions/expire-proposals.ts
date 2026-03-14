// ---------------------------------------------------------------------------
// Inngest Function — Expire Stale Proposals
//
// Cron function running every 15 minutes. Fans out per operator, calls
// expireStaleProposals(), logs results, and creates audit events.
// ---------------------------------------------------------------------------

import { inngest } from "../client";
import { db } from "@/lib/db";
import { getActiveOperatorIds } from "@/lib/db/queries/operators";
import { expireStaleProposals } from "@/lib/db/queries/proposals";
import { AuditService } from "@/lib/engine/audit";
import { AUDIT_EVENT_TYPES } from "@/lib/types/audit";
import { logger } from "@/lib/observability";

export const expireProposalsCron = inngest.createFunction(
  {
    id: "expire-proposals-cron",
    name: "Expire Stale Proposals",
  },
  { cron: "*/15 * * * *" },
  async ({ step }) => {
    const operatorIds = await step.run("get-active-operators", async () => {
      return getActiveOperatorIds(db);
    });

    if (operatorIds.length === 0) {
      logger.info("No active operators found for proposal expiration");
      return { message: "No active operators found", expired: 0 };
    }

    let totalExpired = 0;

    for (const operatorId of operatorIds) {
      const expiredCount = await step.run(
        `expire-proposals-operator-${operatorId}`,
        async () => {
          const count = await expireStaleProposals(db, operatorId);

          if (count > 0) {
            const auditService = new AuditService(db);

            await auditService.logEvent(
              operatorId,
              AUDIT_EVENT_TYPES.PROPOSAL_EXPIRED,
              {
                entityType: "proposal",
                payload: { count, reason: "stale_expiration" },
              }
            );

            logger.info("Expired stale proposals", {
              operatorId,
              count,
            } as Record<string, unknown>);
          }

          return count;
        }
      );

      totalExpired += expiredCount;
    }

    return {
      message: `Expired ${totalExpired} proposal(s) across ${operatorIds.length} operator(s)`,
      expired: totalExpired,
      operatorCount: operatorIds.length,
    };
  }
);
