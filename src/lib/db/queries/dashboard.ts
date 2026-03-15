// ---------------------------------------------------------------------------
// Dashboard Queries — Aggregate metrics for the dashboard overview
// ---------------------------------------------------------------------------

import { sql, eq, and, gte } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { startOfDay } from "date-fns";
import { proposals, schedulingTriggers, auditEvents, approvalDecisions } from "@/lib/db/schema";
import type { DashboardMetrics, RecentActivityItem } from "@/lib/types/dashboard-metrics";

/**
 * Fetch aggregated dashboard metrics for a given operator.
 * Counts proposals by status, active triggers, and recent audit activity.
 */
export async function getDashboardMetrics(
  db: PostgresJsDatabase,
  operatorId: number
): Promise<{ metrics: DashboardMetrics; recentActivity: RecentActivityItem[] }> {
  const todayStart = startOfDay(new Date());
  const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const last30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [
    pendingResult,
    approvedTodayResult,
    declinedTodayResult,
    executedTodayResult,
    activeWorkflowsResult,
    recentActivityCountResult,
    recentActivityRows,
    autoApprovedResult,
    acceptanceRateResult,
    avgTimeToFillResult,
  ] = await Promise.all([
    // Pending proposals
    db
      .select({ count: sql<number>`cast(count(*) as integer)` })
      .from(proposals)
      .where(and(eq(proposals.operatorId, operatorId), eq(proposals.status, "pending"))),

    // Approved today
    db
      .select({ count: sql<number>`cast(count(*) as integer)` })
      .from(proposals)
      .where(
        and(
          eq(proposals.operatorId, operatorId),
          eq(proposals.status, "approved"),
          gte(proposals.updatedAt, todayStart)
        )
      ),

    // Declined today
    db
      .select({ count: sql<number>`cast(count(*) as integer)` })
      .from(proposals)
      .where(
        and(
          eq(proposals.operatorId, operatorId),
          eq(proposals.status, "declined"),
          gte(proposals.updatedAt, todayStart)
        )
      ),

    // Executed today
    db
      .select({ count: sql<number>`cast(count(*) as integer)` })
      .from(proposals)
      .where(
        and(
          eq(proposals.operatorId, operatorId),
          eq(proposals.status, "executed"),
          gte(proposals.updatedAt, todayStart)
        )
      ),

    // Active triggers (processing)
    db
      .select({ count: sql<number>`cast(count(*) as integer)` })
      .from(schedulingTriggers)
      .where(
        and(
          eq(schedulingTriggers.operatorId, operatorId),
          eq(schedulingTriggers.status, "processing")
        )
      ),

    // Recent audit events count (last 24h)
    db
      .select({ count: sql<number>`cast(count(*) as integer)` })
      .from(auditEvents)
      .where(
        and(
          eq(auditEvents.operatorId, operatorId),
          gte(auditEvents.createdAt, last24h)
        )
      ),

    // Last 10 audit events as recent activity
    db
      .select({
        id: auditEvents.id,
        eventType: auditEvents.eventType,
        entityType: auditEvents.entityType,
        entityId: auditEvents.entityId,
        createdAt: auditEvents.createdAt,
        operatorId: auditEvents.operatorId,
      })
      .from(auditEvents)
      .where(eq(auditEvents.operatorId, operatorId))
      .orderBy(sql`${auditEvents.createdAt} desc`)
      .limit(10),

    // Auto-approved today (executed proposals with autoApproved flag in validation snapshot)
    db
      .select({ count: sql<number>`cast(count(*) as integer)` })
      .from(proposals)
      .where(
        and(
          eq(proposals.operatorId, operatorId),
          eq(proposals.status, "executed"),
          sql`${proposals.validationSnapshot}->>'autoApproved' = 'true'`,
          gte(proposals.updatedAt, todayStart)
        )
      ),

    // Acceptance rate (last 30 days): approved / (approved + declined)
    db
      .select({
        approved: sql<number>`cast(count(*) filter (where ${approvalDecisions.decision} = 'approved') as integer)`,
        total: sql<number>`cast(count(*) as integer)`,
      })
      .from(approvalDecisions)
      .where(
        and(
          eq(approvalDecisions.operatorId, operatorId),
          gte(approvalDecisions.decidedAt, last30d)
        )
      ),

    // Average time-to-fill (last 30 days): avg hours from proposal createdAt to updatedAt for executed proposals
    db
      .select({
        avgHours: sql<number | null>`cast(avg(extract(epoch from ${proposals.updatedAt} - ${proposals.createdAt}) / 3600) as double precision)`,
      })
      .from(proposals)
      .where(
        and(
          eq(proposals.operatorId, operatorId),
          eq(proposals.status, "executed"),
          gte(proposals.updatedAt, last30d)
        )
      ),
  ]);

  const acceptanceTotal = acceptanceRateResult[0]?.total ?? 0;
  const acceptanceApproved = acceptanceRateResult[0]?.approved ?? 0;
  const rawAvgHours = avgTimeToFillResult[0]?.avgHours;

  const metrics: DashboardMetrics = {
    pendingProposals: pendingResult[0]?.count ?? 0,
    approvedToday: approvedTodayResult[0]?.count ?? 0,
    declinedToday: declinedTodayResult[0]?.count ?? 0,
    executedToday: executedTodayResult[0]?.count ?? 0,
    activeWorkflows: activeWorkflowsResult[0]?.count ?? 0,
    recentActivity: recentActivityCountResult[0]?.count ?? 0,
    autoApprovedToday: autoApprovedResult[0]?.count ?? 0,
    acceptanceRate:
      acceptanceTotal > 0
        ? Math.round((acceptanceApproved / acceptanceTotal) * 100)
        : null,
    avgTimeToFillHours:
      rawAvgHours != null ? Math.round(rawAvgHours * 10) / 10 : null,
  };

  const recentActivity: RecentActivityItem[] = recentActivityRows.map((row) => ({
    id: row.id,
    eventType: row.eventType,
    entityType: row.entityType ?? "",
    summary: formatActivitySummary(row.eventType, row.entityType, row.entityId),
    timestamp: row.createdAt.toISOString(),
    operatorId: row.operatorId,
  }));

  return { metrics, recentActivity };
}

/** Generate a human-readable summary for an activity item. */
function formatActivitySummary(
  eventType: string,
  entityType: string | null,
  entityId: string | null
): string {
  const entity = entityType ? `${entityType}` : "item";
  const id = entityId ? ` ${entityId.slice(0, 8)}` : "";
  const action = eventType.replace(/_/g, " ");
  return `${action}: ${entity}${id}`;
}
