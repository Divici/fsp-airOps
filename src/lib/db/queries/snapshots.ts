// ---------------------------------------------------------------------------
// Snapshot Query Functions — Load/save schedule snapshots for cancellation detection
// ---------------------------------------------------------------------------

import { eq } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { scheduleSnapshots } from "@/lib/db/schema";

export async function loadSnapshot(
  db: PostgresJsDatabase,
  operatorId: number,
): Promise<{ capturedAt: Date; reservations: Array<[string, unknown]> } | null> {
  const rows = await db
    .select()
    .from(scheduleSnapshots)
    .where(eq(scheduleSnapshots.operatorId, operatorId))
    .limit(1);

  if (rows.length === 0) return null;

  return {
    capturedAt: rows[0].capturedAt,
    reservations: rows[0].reservations as Array<[string, unknown]>,
  };
}

export async function saveSnapshot(
  db: PostgresJsDatabase,
  operatorId: number,
  capturedAt: Date,
  reservations: Array<[string, unknown]>,
): Promise<void> {
  await db
    .insert(scheduleSnapshots)
    .values({ operatorId, capturedAt, reservations })
    .onConflictDoUpdate({
      target: scheduleSnapshots.operatorId,
      set: { capturedAt, reservations, createdAt: new Date() },
    });
}
