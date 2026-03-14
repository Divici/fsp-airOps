// ---------------------------------------------------------------------------
// WaitlistRanker — Ranks candidates using configurable weighted signals
// ---------------------------------------------------------------------------

import type { WaitlistCandidate, WaitlistWeights } from "./types";
import { normalizeSignal } from "./signals";

export class WaitlistRanker {
  constructor(private weights: WaitlistWeights) {}

  /**
   * Rank candidates by weighted sum of normalized signals.
   * Returns a new array sorted by eligibilityScore descending.
   * Ties are broken by studentName ascending for deterministic ordering.
   */
  rankCandidates(candidates: WaitlistCandidate[]): WaitlistCandidate[] {
    if (candidates.length === 0) return [];

    // Compute min/max for each signal across all candidates (for normalization)
    const bounds = this.computeBounds(candidates);

    const scored = candidates.map((candidate) => {
      const score = this.computeScore(candidate, bounds);
      return { ...candidate, eligibilityScore: Math.round(score * 1000) / 1000 };
    });

    scored.sort((a, b) => {
      const diff = b.eligibilityScore - a.eligibilityScore;
      if (diff !== 0) return diff;
      // Secondary sort: alphabetical by name for determinism
      return a.studentName.localeCompare(b.studentName);
    });

    return scored;
  }

  private computeScore(
    candidate: WaitlistCandidate,
    bounds: SignalBounds,
  ): number {
    const s = candidate.signals;

    const timeSinceLast = normalizeSignal(
      s.timeSinceLastFlight,
      bounds.timeSinceLastFlight.min,
      bounds.timeSinceLastFlight.max,
    );
    const timeUntilNext = normalizeSignal(
      s.timeUntilNextFlight,
      bounds.timeUntilNextFlight.min,
      bounds.timeUntilNextFlight.max,
    );
    const totalHrs = normalizeSignal(
      s.totalHours,
      bounds.totalHours.min,
      bounds.totalHours.max,
    );
    // Boolean signals are already 0 or 1 — no normalization needed
    const instrCont = s.instructorContinuity;
    const acftFam = s.aircraftFamiliarity;

    return (
      this.weights.timeSinceLastFlight * timeSinceLast +
      this.weights.timeUntilNextFlight * timeUntilNext +
      this.weights.totalHours * totalHrs +
      this.weights.instructorContinuity * instrCont +
      this.weights.aircraftFamiliarity * acftFam
    );
  }

  private computeBounds(candidates: WaitlistCandidate[]): SignalBounds {
    const finiteValues = (vals: number[]) =>
      vals.filter((v) => isFinite(v));

    const timeSinceLast = finiteValues(
      candidates.map((c) => c.signals.timeSinceLastFlight),
    );
    const timeUntilNext = finiteValues(
      candidates.map((c) => c.signals.timeUntilNextFlight),
    );
    const totalHours = finiteValues(
      candidates.map((c) => c.signals.totalHours),
    );

    return {
      timeSinceLastFlight: {
        min: timeSinceLast.length > 0 ? Math.min(...timeSinceLast) : 0,
        max: timeSinceLast.length > 0 ? Math.max(...timeSinceLast) : 1,
      },
      timeUntilNextFlight: {
        min: timeUntilNext.length > 0 ? Math.min(...timeUntilNext) : 0,
        max: timeUntilNext.length > 0 ? Math.max(...timeUntilNext) : 1,
      },
      totalHours: {
        min: totalHours.length > 0 ? Math.min(...totalHours) : 0,
        max: totalHours.length > 0 ? Math.max(...totalHours) : 1,
      },
    };
  }
}

interface SignalBounds {
  timeSinceLastFlight: { min: number; max: number };
  timeUntilNextFlight: { min: number; max: number };
  totalHours: { min: number; max: number };
}
