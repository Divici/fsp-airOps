// ---------------------------------------------------------------------------
// Audit Event Query Functions — Append-only, no update/delete
// ---------------------------------------------------------------------------

import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { auditEvents } from "@/lib/db/schema";
import type { AuditEvent } from "@/lib/db/schema";
import type { AuditEventType } from "@/lib/types/audit";

/**
 * Insert a new audit event. Audit events are immutable — this is the only
 * write operation exposed by this module.
 */
export async function insertAuditEvent(
  db: PostgresJsDatabase,
  params: {
    operatorId: number;
    eventType: AuditEventType;
    entityId?: string;
    entityType?: string;
    payload?: Record<string, unknown>;
  }
): Promise<AuditEvent> {
  const rows = await db
    .insert(auditEvents)
    .values({
      operatorId: params.operatorId,
      eventType: params.eventType,
      entityId: params.entityId ?? null,
      entityType: params.entityType ?? null,
      payload: params.payload ?? null,
    })
    .returning();

  return rows[0];
}

/**
 * Query audit events with filters and cursor-based pagination.
 * Returns matching events and the total count for the filter set.
 */
export async function queryAuditEvents(
  db: PostgresJsDatabase,
  params: {
    operatorId: number;
    eventType?: AuditEventType;
    entityId?: string;
    entityType?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }
): Promise<{ events: AuditEvent[]; total: number }> {
  const conditions = [eq(auditEvents.operatorId, params.operatorId)];

  if (params.eventType) {
    conditions.push(eq(auditEvents.eventType, params.eventType));
  }
  if (params.entityId) {
    conditions.push(eq(auditEvents.entityId, params.entityId));
  }
  if (params.entityType) {
    conditions.push(eq(auditEvents.entityType, params.entityType));
  }
  if (params.startDate) {
    conditions.push(gte(auditEvents.createdAt, params.startDate));
  }
  if (params.endDate) {
    conditions.push(lte(auditEvents.createdAt, params.endDate));
  }

  const where = and(...conditions);

  const [events, totalResult] = await Promise.all([
    db
      .select()
      .from(auditEvents)
      .where(where)
      .orderBy(desc(auditEvents.createdAt))
      .limit(params.limit ?? 50)
      .offset(params.offset ?? 0),
    db
      .select({ count: sql<number>`cast(count(*) as integer)` })
      .from(auditEvents)
      .where(where),
  ]);

  return { events, total: totalResult[0]?.count ?? 0 };
}
