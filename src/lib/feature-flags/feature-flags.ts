// ---------------------------------------------------------------------------
// FeatureFlagService — per-operator feature flag resolution
// ---------------------------------------------------------------------------

import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import { operatorSettings } from "@/lib/db/schema";
import type {
  FeatureFlags,
  FeatureFlagName,
} from "./types";
import { DEFAULT_FEATURE_FLAGS } from "./types";

/**
 * Maps operator_settings columns to feature flags.
 * enabledWorkflows -> workflow flags
 * communicationPreferences -> notification flags
 */
function resolveFlags(
  enabledWorkflows?: Record<string, boolean> | null,
  communicationPreferences?: Record<string, boolean> | null
): Partial<FeatureFlags> {
  const flags: Partial<FeatureFlags> = {};

  if (enabledWorkflows) {
    if ("reschedule" in enabledWorkflows)
      flags.enableReschedule = enabledWorkflows.reschedule;
    if ("discovery_flight" in enabledWorkflows)
      flags.enableDiscoveryFlight = enabledWorkflows.discovery_flight;
    if ("next_lesson" in enabledWorkflows)
      flags.enableNextLesson = enabledWorkflows.next_lesson;
    if ("waitlist" in enabledWorkflows)
      flags.enableWaitlist = enabledWorkflows.waitlist;
  }

  if (communicationPreferences) {
    if ("email" in communicationPreferences)
      flags.enableEmailNotifications = communicationPreferences.email;
    if ("sms" in communicationPreferences)
      flags.enableSmsNotifications = communicationPreferences.sms;
  }

  return flags;
}

export class FeatureFlagService {
  constructor(private db: PostgresJsDatabase) {}

  /**
   * Get the merged feature flags for an operator.
   * Operator settings override defaults.
   */
  async getFlags(operatorId: number): Promise<FeatureFlags> {
    const rows = await this.db
      .select({
        enabledWorkflows: operatorSettings.enabledWorkflows,
        communicationPreferences: operatorSettings.communicationPreferences,
      })
      .from(operatorSettings)
      .where(eq(operatorSettings.operatorId, operatorId))
      .limit(1);

    if (rows.length === 0) {
      return { ...DEFAULT_FEATURE_FLAGS };
    }

    const row = rows[0];
    const overrides = resolveFlags(
      row.enabledWorkflows as Record<string, boolean> | null,
      row.communicationPreferences as Record<string, boolean> | null
    );

    return { ...DEFAULT_FEATURE_FLAGS, ...overrides };
  }

  /**
   * Check a single flag for an operator.
   */
  async isEnabled(
    operatorId: number,
    flag: FeatureFlagName
  ): Promise<boolean> {
    const flags = await this.getFlags(operatorId);
    return flags[flag];
  }
}
