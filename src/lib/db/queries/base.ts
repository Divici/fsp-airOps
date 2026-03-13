// ---------------------------------------------------------------------------
// Tenant-scoped query helpers — enforce operatorId on every query.
// ---------------------------------------------------------------------------

import { eq, and, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";

/** Minimal interface for any table that has an operatorId column. */
interface TenantScopedTable {
  operatorId: PgColumn;
}

/**
 * Create a where clause that filters rows to the given tenant.
 *
 * @example
 *   db.select().from(proposals).where(withTenant(proposals, ctx.operatorId))
 */
export function withTenant<T extends TenantScopedTable>(
  table: T,
  operatorId: number
): SQL {
  return eq(table.operatorId, operatorId);
}

/**
 * Combine a tenant scope with additional where conditions.
 *
 * @example
 *   db.select()
 *     .from(proposals)
 *     .where(withTenantAnd(proposals, ctx.operatorId, eq(proposals.status, 'pending')))
 */
export function withTenantAnd<T extends TenantScopedTable>(
  table: T,
  operatorId: number,
  ...conditions: SQL[]
): SQL {
  return and(eq(table.operatorId, operatorId), ...conditions)!;
}
