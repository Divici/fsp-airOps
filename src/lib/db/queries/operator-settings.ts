import { eq } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { operatorSettings } from "@/lib/db/schema";
import type { OperatorSettings, NewOperatorSettings } from "@/lib/db/schema";
import { DEFAULT_OPERATOR_SETTINGS } from "@/config/defaults";

/** Returns the operator's settings, or defaults if none exist. */
export async function getOperatorSettings(
  db: PostgresJsDatabase,
  operatorId: number
): Promise<OperatorSettings> {
  const rows = await db
    .select()
    .from(operatorSettings)
    .where(eq(operatorSettings.operatorId, operatorId))
    .limit(1);

  if (rows.length > 0) {
    return rows[0];
  }

  // Return virtual defaults (not persisted)
  const now = new Date();
  return {
    id: "",
    operatorId,
    ...DEFAULT_OPERATOR_SETTINGS,
    enabledWorkflows: { ...DEFAULT_OPERATOR_SETTINGS.enabledWorkflows },
    communicationPreferences: {
      ...DEFAULT_OPERATOR_SETTINGS.communicationPreferences,
    },
    createdAt: now,
    updatedAt: now,
  };
}

/** Create or update operator settings. Returns the upserted row. */
export async function upsertOperatorSettings(
  db: PostgresJsDatabase,
  operatorId: number,
  settings: Partial<Omit<NewOperatorSettings, "id" | "operatorId" | "createdAt" | "updatedAt">>
): Promise<OperatorSettings> {
  const rows = await db
    .insert(operatorSettings)
    .values({
      operatorId,
      ...settings,
    })
    .onConflictDoUpdate({
      target: operatorSettings.operatorId,
      set: {
        ...settings,
        updatedAt: new Date(),
      },
    })
    .returning();

  return rows[0];
}

/** Reset operator settings to defaults. Returns the updated row. */
export async function resetOperatorSettings(
  db: PostgresJsDatabase,
  operatorId: number
): Promise<OperatorSettings> {
  const { enabledWorkflows, communicationPreferences, ...scalarDefaults } =
    DEFAULT_OPERATOR_SETTINGS;

  const rows = await db
    .insert(operatorSettings)
    .values({
      operatorId,
      ...scalarDefaults,
      enabledWorkflows: { ...enabledWorkflows },
      communicationPreferences: { ...communicationPreferences },
    })
    .onConflictDoUpdate({
      target: operatorSettings.operatorId,
      set: {
        ...scalarDefaults,
        enabledWorkflows: { ...enabledWorkflows },
        communicationPreferences: { ...communicationPreferences },
        updatedAt: new Date(),
      },
    })
    .returning();

  return rows[0];
}
