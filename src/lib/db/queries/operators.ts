// ---------------------------------------------------------------------------
// Operator Query Functions — List active operators for scheduled jobs
// ---------------------------------------------------------------------------

import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { operatorSettings } from "@/lib/db/schema";

/**
 * Return all distinct operator IDs that have settings configured.
 * In production this would come from a dedicated operators table;
 * for now we derive it from operator_settings.
 */
export async function getActiveOperatorIds(
  db: PostgresJsDatabase,
): Promise<number[]> {
  const rows = await db
    .select({ operatorId: operatorSettings.operatorId })
    .from(operatorSettings);

  return rows.map((r) => r.operatorId);
}
