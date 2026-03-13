// ---------------------------------------------------------------------------
// Trigger Query Functions — CRUD + deduplication for scheduling triggers
// ---------------------------------------------------------------------------

import { and, desc, eq, gte, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { schedulingTriggers } from "@/lib/db/schema";
import type { SchedulingTrigger } from "@/lib/db/schema";
import type { TriggerType, TriggerStatus } from "@/lib/types/domain";

/**
 * Create a new scheduling trigger and return its ID.
 */
export async function createTrigger(
  db: PostgresJsDatabase,
  params: {
    operatorId: number;
    type: TriggerType;
    sourceEntityId?: string;
    sourceEntityType?: string;
    context?: Record<string, unknown>;
  }
): Promise<string> {
  const rows = await db
    .insert(schedulingTriggers)
    .values({
      operatorId: params.operatorId,
      type: params.type,
      sourceEntityId: params.sourceEntityId ?? null,
      sourceEntityType: params.sourceEntityType ?? null,
      context: params.context ?? null,
    })
    .returning({ id: schedulingTriggers.id });

  return rows[0].id;
}

/**
 * Get a trigger by ID, scoped to a tenant.
 */
export async function getTriggerById(
  db: PostgresJsDatabase,
  operatorId: number,
  triggerId: string
): Promise<SchedulingTrigger | null> {
  const rows = await db
    .select()
    .from(schedulingTriggers)
    .where(
      and(
        eq(schedulingTriggers.operatorId, operatorId),
        eq(schedulingTriggers.id, triggerId)
      )
    )
    .limit(1);

  return rows[0] ?? null;
}

/**
 * Update a trigger's status, optionally recording an error message.
 */
export async function updateTriggerStatus(
  db: PostgresJsDatabase,
  operatorId: number,
  triggerId: string,
  status: TriggerStatus,
  error?: string
): Promise<void> {
  await db
    .update(schedulingTriggers)
    .set({
      status,
      error: error ?? null,
    })
    .where(
      and(
        eq(schedulingTriggers.operatorId, operatorId),
        eq(schedulingTriggers.id, triggerId)
      )
    );
}

/**
 * Check whether a duplicate trigger exists for the same operator, type, and
 * source entity within a sliding time window (default 30 minutes).
 */
export async function isDuplicateTrigger(
  db: PostgresJsDatabase,
  params: {
    operatorId: number;
    type: TriggerType;
    sourceEntityId: string;
    windowMinutes?: number;
  }
): Promise<boolean> {
  const windowMinutes = params.windowMinutes ?? 30;
  const cutoff = new Date(Date.now() - windowMinutes * 60 * 1000);

  const rows = await db
    .select({ count: sql<number>`cast(count(*) as integer)` })
    .from(schedulingTriggers)
    .where(
      and(
        eq(schedulingTriggers.operatorId, params.operatorId),
        eq(schedulingTriggers.type, params.type),
        eq(schedulingTriggers.sourceEntityId, params.sourceEntityId),
        gte(schedulingTriggers.createdAt, cutoff)
      )
    );

  return (rows[0]?.count ?? 0) > 0;
}

/**
 * List recent triggers with optional filters and pagination.
 */
export async function listTriggers(
  db: PostgresJsDatabase,
  params: {
    operatorId: number;
    type?: TriggerType;
    status?: TriggerStatus;
    limit?: number;
    offset?: number;
  }
): Promise<{ triggers: SchedulingTrigger[]; total: number }> {
  const conditions = [eq(schedulingTriggers.operatorId, params.operatorId)];

  if (params.type) {
    conditions.push(eq(schedulingTriggers.type, params.type));
  }
  if (params.status) {
    conditions.push(eq(schedulingTriggers.status, params.status));
  }

  const where = and(...conditions);

  const [triggers, totalResult] = await Promise.all([
    db
      .select()
      .from(schedulingTriggers)
      .where(where)
      .orderBy(desc(schedulingTriggers.createdAt))
      .limit(params.limit ?? 50)
      .offset(params.offset ?? 0),
    db
      .select({ count: sql<number>`cast(count(*) as integer)` })
      .from(schedulingTriggers)
      .where(where),
  ]);

  return { triggers, total: totalResult[0]?.count ?? 0 };
}

/**
 * Mark a trigger as processed by setting processedAt and status to completed.
 */
export async function markTriggerProcessed(
  db: PostgresJsDatabase,
  operatorId: number,
  triggerId: string
): Promise<void> {
  await db
    .update(schedulingTriggers)
    .set({
      status: "completed" as TriggerStatus,
      processedAt: new Date(),
    })
    .where(
      and(
        eq(schedulingTriggers.operatorId, operatorId),
        eq(schedulingTriggers.id, triggerId)
      )
    );
}
