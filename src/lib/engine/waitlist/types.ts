// ---------------------------------------------------------------------------
// Waitlist Types — Shared interfaces for waitlist automation
// ---------------------------------------------------------------------------

/** Signals used to rank waitlist candidates. */
export interface WaitlistSignals {
  /** Hours since the student's last completed flight. */
  timeSinceLastFlight: number;
  /** Hours until the student's next scheduled flight. */
  timeUntilNextFlight: number;
  /** Total logged flight hours for the student. */
  totalHours: number;
  /** 1 if the opening's instructor is the same as the student's recent instructor, 0 otherwise. */
  instructorContinuity: number;
  /** 1 if the student has flown the opening's aircraft before, 0 otherwise. */
  aircraftFamiliarity: number;
}

/** A candidate student eligible for a waitlist opening. */
export interface WaitlistCandidate {
  studentId: string;
  studentName: string;
  enrollmentId: string;
  /** The next schedulable event for this student. */
  nextEventId: string;
  /** Composite score computed from weighted signals (higher = better). */
  eligibilityScore: number;
  /** Raw signal values before weighting. */
  signals: WaitlistSignals;
  /** Whether this student is flagged as checkride-ready (near training completion). */
  isCheckrideReady?: boolean;
}

/** Constraints describing a schedule opening that needs to be filled. */
export interface OpeningConstraints {
  /** Time window of the opening. */
  timeWindow: {
    start: Date;
    end: Date;
  };
  /** FSP location ID. */
  locationId: number;
  /** Required aircraft type (e.g. "Cessna 172S"), optional. */
  aircraftType?: string;
  /** Required FSP activity type ID, optional. */
  activityTypeId?: string;
}

/** Result of an eligibility check for a student against a specific slot. */
export interface EligibilityResult {
  eligible: boolean;
  reason?: string;
}

/** Ranking weight configuration (sourced from OperatorSettings). */
export interface WaitlistWeights {
  timeSinceLastFlight: number;
  timeUntilNextFlight: number;
  totalHours: number;
  instructorContinuity: number;
  aircraftFamiliarity: number;
}

/** Operator-defined custom weight entry. */
export interface CustomWeight {
  name: string;
  signal: string;
  weight: number;
  enabled: boolean;
}

/**
 * Map of custom signal names to their resolver functions.
 * Each resolver extracts a numeric value from a WaitlistCandidate's signals.
 */
export type CustomSignalResolver = (signals: WaitlistSignals) => number;

/** Built-in custom signal names and their mapping to WaitlistSignals fields. */
export const CUSTOM_SIGNAL_MAP: Record<string, CustomSignalResolver> = {
  daysSinceLastFlight: (s) => s.timeSinceLastFlight / 24,
  daysUntilExpiry: (s) => s.timeUntilNextFlight / 24,
  totalHours: (s) => s.totalHours,
  lessonCompletionRate: (s) => s.instructorContinuity, // maps to a 0-1 signal
};
