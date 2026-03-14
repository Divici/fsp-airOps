// ---------------------------------------------------------------------------
// Waitlist Module — Public API
// ---------------------------------------------------------------------------

export { CandidateFinder } from "./candidate-finder";
export { EligibilityChecker } from "./eligibility-checker";
export { WaitlistRanker } from "./ranker";
export {
  computeTimeSinceLastFlight,
  computeTimeUntilNextFlight,
  computeTotalHours,
  computeInstructorContinuity,
  computeAircraftFamiliarity,
  normalizeSignal,
} from "./signals";
export type {
  WaitlistSignals,
  WaitlistCandidate,
  OpeningConstraints,
  EligibilityResult,
  WaitlistWeights,
} from "./types";
