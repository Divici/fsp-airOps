// ---------------------------------------------------------------------------
// WaitlistRanker — Ranks candidates using configurable weighted signals
// ---------------------------------------------------------------------------

import type { WaitlistCandidate, WaitlistWeights, CustomWeight } from "./types";
import { CUSTOM_SIGNAL_MAP } from "./types";
import { normalizeSignal } from "./signals";

export class WaitlistRanker {
  private customWeights: CustomWeight[];

  constructor(
    private weights: WaitlistWeights,
    customWeights: CustomWeight[] = [],
  ) {
    this.customWeights = customWeights.filter((cw) => cw.enabled);
  }

  /**
   * Rank candidates by weighted sum of normalized signals.
   * Returns a new array sorted by eligibilityScore descending.
   * Ties are broken by studentName ascending for deterministic ordering.
   */
  rankCandidates(candidates: WaitlistCandidate[]): WaitlistCandidate[] {
    if (candidates.length === 0) return [];

    // Compute min/max for each signal across all candidates (for normalization)
    const bounds = this.computeBounds(candidates);

    // Compute custom signal bounds
    const customBounds = this.computeCustomBounds(candidates);

    const scored = candidates.map((candidate) => {
      const score = this.computeScore(candidate, bounds, customBounds);
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
    customBounds: Map<string, { min: number; max: number }>,
  ): number {
    const s = candidate.signals;

    // Determine which built-in signals are overridden by custom weights
    const overriddenSignals = new Set<string>();
    for (const cw of this.customWeights) {
      // Map custom signal names to built-in signal names for override detection
      if (cw.signal === "daysSinceLastFlight") overriddenSignals.add("timeSinceLastFlight");
      if (cw.signal === "totalHours") overriddenSignals.add("totalHours");
      if (cw.signal === "daysUntilExpiry") overriddenSignals.add("timeUntilNextFlight");
      if (cw.signal === "lessonCompletionRate") overriddenSignals.add("instructorContinuity");
    }

    // Compute built-in scores (skip overridden ones)
    let score = 0;

    if (!overriddenSignals.has("timeSinceLastFlight")) {
      const timeSinceLast = normalizeSignal(
        s.timeSinceLastFlight,
        bounds.timeSinceLastFlight.min,
        bounds.timeSinceLastFlight.max,
      );
      score += this.weights.timeSinceLastFlight * timeSinceLast;
    }

    if (!overriddenSignals.has("timeUntilNextFlight")) {
      const timeUntilNext = normalizeSignal(
        s.timeUntilNextFlight,
        bounds.timeUntilNextFlight.min,
        bounds.timeUntilNextFlight.max,
      );
      score += this.weights.timeUntilNextFlight * timeUntilNext;
    }

    if (!overriddenSignals.has("totalHours")) {
      const totalHrs = normalizeSignal(
        s.totalHours,
        bounds.totalHours.min,
        bounds.totalHours.max,
      );
      score += this.weights.totalHours * totalHrs;
    }

    // Boolean signals — override detection for instructorContinuity
    if (!overriddenSignals.has("instructorContinuity")) {
      score += this.weights.instructorContinuity * s.instructorContinuity;
    }

    // aircraftFamiliarity is never overridden by custom signals
    score += this.weights.aircraftFamiliarity * s.aircraftFamiliarity;

    // Apply custom weights
    for (const cw of this.customWeights) {
      const resolver = CUSTOM_SIGNAL_MAP[cw.signal];
      if (!resolver) continue;

      const rawValue = resolver(s);
      const cwBounds = customBounds.get(cw.signal);
      const normalized = cwBounds
        ? normalizeSignal(rawValue, cwBounds.min, cwBounds.max)
        : 0.5;

      score += cw.weight * normalized;
    }

    return score;
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

  private computeCustomBounds(
    candidates: WaitlistCandidate[],
  ): Map<string, { min: number; max: number }> {
    const boundsMap = new Map<string, { min: number; max: number }>();

    for (const cw of this.customWeights) {
      const resolver = CUSTOM_SIGNAL_MAP[cw.signal];
      if (!resolver) continue;

      const values = candidates
        .map((c) => resolver(c.signals))
        .filter((v) => isFinite(v));

      boundsMap.set(cw.signal, {
        min: values.length > 0 ? Math.min(...values) : 0,
        max: values.length > 0 ? Math.max(...values) : 1,
      });
    }

    return boundsMap;
  }
}

interface SignalBounds {
  timeSinceLastFlight: { min: number; max: number };
  timeUntilNextFlight: { min: number; max: number };
  totalHours: { min: number; max: number };
}
