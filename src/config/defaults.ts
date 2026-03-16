export const DEFAULT_OPERATOR_SETTINGS = {
  timeSinceLastFlightWeight: 1.0,
  timeUntilNextFlightWeight: 1.0,
  totalFlightHoursWeight: 0.5,
  preferSameInstructor: true,
  preferSameInstructorWeight: 0.8,
  preferSameAircraft: false,
  preferSameAircraftWeight: 0.3,
  searchWindowDays: 7,
  topNAlternatives: 5,
  daylightOnly: true,
  inactivityThresholdDays: 7,
  enabledWorkflows: {
    reschedule: true,
    discovery_flight: true,
    next_lesson: true,
    waitlist: true,
    inactivity_outreach: true,
    weather_disruption: false,
  },
  communicationPreferences: {
    email: true,
    sms: false,
  },
  customWeights: [] as Array<{
    name: string;
    signal: string;
    weight: number;
    enabled: boolean;
  }>,
  communicationTemplates: null as Record<string, { subject: string; body: string }> | null,
  weatherMinCeiling: 1000,
  weatherMinVisibility: 3,
  brandColor: "#2563eb",
  logoUrl: null as string | null,
  autoApprovalEnabled: false,
  autoApprovalThreshold: 0.7,
} as const;
