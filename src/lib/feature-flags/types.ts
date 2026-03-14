// ---------------------------------------------------------------------------
// Feature Flags — typed, per-operator feature flags
// ---------------------------------------------------------------------------

/**
 * All available feature flags with their types.
 * Each flag defaults to a sensible value when no operator override exists.
 */
export interface FeatureFlags {
  enableReschedule: boolean;
  enableDiscoveryFlight: boolean;
  enableNextLesson: boolean;
  enableWaitlist: boolean;
  enableAiRationale: boolean;
  enableEmailNotifications: boolean;
  enableSmsNotifications: boolean;
}

/**
 * The flag name union — used for type-safe flag lookups.
 */
export type FeatureFlagName = keyof FeatureFlags;

/**
 * Default values for all flags.
 */
export const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  enableReschedule: true,
  enableDiscoveryFlight: true,
  enableNextLesson: true,
  enableWaitlist: true,
  enableAiRationale: true,
  enableEmailNotifications: true,
  enableSmsNotifications: false,
};
