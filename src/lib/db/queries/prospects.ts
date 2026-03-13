// ---------------------------------------------------------------------------
// Prospect Request CRUD — Tenant-scoped queries for prospect requests
// ---------------------------------------------------------------------------

import { eq, and, sql, gte, lte, inArray, desc } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { prospectRequests } from "@/lib/db/schema";
import type { ProspectRequest } from "@/lib/db/schema";
import type { ProspectStatus } from "@/lib/types/domain";
import { withTenant, withTenantAnd } from "./base";

// ---------------------------------------------------------------------------
// Status transition validation
// ---------------------------------------------------------------------------

const VALID_TRANSITIONS: Record<ProspectStatus, ProspectStatus[]> = {
  new: ["processing", "cancelled"],
  processing: ["proposed", "cancelled"],
  proposed: ["approved", "cancelled"],
  approved: ["booked", "cancelled"],
  booked: [],
  cancelled: [],
};

export function assertProspectTransition(
  from: ProspectStatus,
  to: ProspectStatus
): void {
  const allowed = VALID_TRANSITIONS[from];
  if (!allowed || !allowed.includes(to)) {
    throw new Error(
      `Invalid prospect status transition: ${from} → ${to}`
    );
  }
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export interface CreateProspectParams {
  operatorId: number;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  preferredLocationId?: number;
  preferredDateStart?: string;
  preferredDateEnd?: string;
  preferredTimeWindows?: Array<{ start: string; end: string }>;
  notes?: string;
}

export async function createProspectRequest(
  db: PostgresJsDatabase,
  params: CreateProspectParams
): Promise<ProspectRequest> {
  const [row] = await db
    .insert(prospectRequests)
    .values({
      operatorId: params.operatorId,
      firstName: params.firstName,
      lastName: params.lastName,
      email: params.email,
      phone: params.phone ?? null,
      preferredLocationId: params.preferredLocationId ?? null,
      preferredDateStart: params.preferredDateStart ?? null,
      preferredDateEnd: params.preferredDateEnd ?? null,
      preferredTimeWindows: params.preferredTimeWindows ?? null,
      notes: params.notes ?? null,
      status: "new",
    })
    .returning();

  return row;
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

export async function getProspectById(
  db: PostgresJsDatabase,
  operatorId: number,
  prospectId: string
): Promise<ProspectRequest | null> {
  const rows = await db
    .select()
    .from(prospectRequests)
    .where(
      withTenantAnd(
        prospectRequests,
        operatorId,
        eq(prospectRequests.id, prospectId)
      )
    )
    .limit(1);

  return rows[0] ?? null;
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

export interface ListProspectsParams {
  operatorId: number;
  status?: ProspectStatus | ProspectStatus[];
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

export async function listProspectRequests(
  db: PostgresJsDatabase,
  params: ListProspectsParams
): Promise<{ prospects: ProspectRequest[]; total: number }> {
  const conditions = [withTenant(prospectRequests, params.operatorId)];

  if (params.status !== undefined) {
    const statuses = Array.isArray(params.status)
      ? params.status
      : [params.status];
    conditions.push(inArray(prospectRequests.status, statuses));
  }

  if (params.startDate !== undefined) {
    conditions.push(gte(prospectRequests.createdAt, new Date(params.startDate)));
  }

  if (params.endDate !== undefined) {
    conditions.push(lte(prospectRequests.createdAt, new Date(params.endDate)));
  }

  const whereClause = and(...conditions)!;

  const [countResult, rows] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(prospectRequests)
      .where(whereClause),
    db
      .select()
      .from(prospectRequests)
      .where(whereClause)
      .orderBy(desc(prospectRequests.createdAt))
      .limit(params.limit ?? 50)
      .offset(params.offset ?? 0),
  ]);

  return {
    prospects: rows,
    total: countResult[0]?.count ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Update status
// ---------------------------------------------------------------------------

export async function updateProspectStatus(
  db: PostgresJsDatabase,
  operatorId: number,
  prospectId: string,
  status: ProspectStatus
): Promise<void> {
  const existing = await db
    .select({ status: prospectRequests.status })
    .from(prospectRequests)
    .where(
      withTenantAnd(
        prospectRequests,
        operatorId,
        eq(prospectRequests.id, prospectId)
      )
    )
    .limit(1);

  if (existing.length === 0) {
    throw new Error(`Prospect request not found: ${prospectId}`);
  }

  assertProspectTransition(existing[0].status!, status);

  await db
    .update(prospectRequests)
    .set({ status, updatedAt: new Date() })
    .where(
      withTenantAnd(
        prospectRequests,
        operatorId,
        eq(prospectRequests.id, prospectId)
      )
    );
}
