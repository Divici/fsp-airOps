import { describe, it, expect } from "vitest";
import { WaitlistRanker } from "../ranker";
import type { WaitlistCandidate, WaitlistWeights, CustomWeight } from "../types";

function makeCandidate(
  overrides: Partial<WaitlistCandidate> & { studentId: string },
): WaitlistCandidate {
  return {
    studentName: overrides.studentId,
    enrollmentId: "enr-test",
    nextEventId: "evt-test",
    eligibilityScore: 0,
    signals: {
      timeSinceLastFlight: 48,
      timeUntilNextFlight: 72,
      totalHours: 20,
      instructorContinuity: 0,
      aircraftFamiliarity: 0,
    },
    ...overrides,
  };
}

const equalWeights: WaitlistWeights = {
  timeSinceLastFlight: 1,
  timeUntilNextFlight: 1,
  totalHours: 1,
  instructorContinuity: 1,
  aircraftFamiliarity: 1,
};

describe("WaitlistRanker", () => {
  it("should rank candidates by weighted score", () => {
    const ranker = new WaitlistRanker({
      timeSinceLastFlight: 2,
      timeUntilNextFlight: 0,
      totalHours: 0,
      instructorContinuity: 0,
      aircraftFamiliarity: 0,
    });

    const candidates: WaitlistCandidate[] = [
      makeCandidate({
        studentId: "low",
        studentName: "Low Time",
        signals: {
          timeSinceLastFlight: 10,
          timeUntilNextFlight: 50,
          totalHours: 20,
          instructorContinuity: 0,
          aircraftFamiliarity: 0,
        },
      }),
      makeCandidate({
        studentId: "high",
        studentName: "High Time",
        signals: {
          timeSinceLastFlight: 100,
          timeUntilNextFlight: 50,
          totalHours: 20,
          instructorContinuity: 0,
          aircraftFamiliarity: 0,
        },
      }),
    ];

    const ranked = ranker.rankCandidates(candidates);
    expect(ranked[0].studentName).toBe("High Time");
    expect(ranked[1].studentName).toBe("Low Time");
  });

  it("should produce different orderings with different weights", () => {
    const candidates: WaitlistCandidate[] = [
      makeCandidate({
        studentId: "a",
        studentName: "Student A",
        signals: {
          timeSinceLastFlight: 100,
          timeUntilNextFlight: 10,
          totalHours: 5,
          instructorContinuity: 0,
          aircraftFamiliarity: 0,
        },
      }),
      makeCandidate({
        studentId: "b",
        studentName: "Student B",
        signals: {
          timeSinceLastFlight: 10,
          timeUntilNextFlight: 100,
          totalHours: 50,
          instructorContinuity: 1,
          aircraftFamiliarity: 1,
        },
      }),
    ];

    // Weight timeSinceLastFlight heavily → A wins
    const ranker1 = new WaitlistRanker({
      timeSinceLastFlight: 10,
      timeUntilNextFlight: 0,
      totalHours: 0,
      instructorContinuity: 0,
      aircraftFamiliarity: 0,
    });
    const ranked1 = ranker1.rankCandidates(candidates);
    expect(ranked1[0].studentName).toBe("Student A");

    // Weight instructor continuity heavily → B wins
    const ranker2 = new WaitlistRanker({
      timeSinceLastFlight: 0,
      timeUntilNextFlight: 0,
      totalHours: 0,
      instructorContinuity: 10,
      aircraftFamiliarity: 0,
    });
    const ranked2 = ranker2.rankCandidates(candidates);
    expect(ranked2[0].studentName).toBe("Student B");
  });

  it("should sort alphabetically by name when scores are equal", () => {
    const ranker = new WaitlistRanker(equalWeights);

    const candidates: WaitlistCandidate[] = [
      makeCandidate({
        studentId: "z",
        studentName: "Zara",
        signals: {
          timeSinceLastFlight: 50,
          timeUntilNextFlight: 50,
          totalHours: 20,
          instructorContinuity: 1,
          aircraftFamiliarity: 1,
        },
      }),
      makeCandidate({
        studentId: "a",
        studentName: "Alice",
        signals: {
          timeSinceLastFlight: 50,
          timeUntilNextFlight: 50,
          totalHours: 20,
          instructorContinuity: 1,
          aircraftFamiliarity: 1,
        },
      }),
    ];

    const ranked = ranker.rankCandidates(candidates);
    expect(ranked[0].studentName).toBe("Alice");
    expect(ranked[1].studentName).toBe("Zara");
  });

  it("should handle all zero weights — all equal scores", () => {
    const ranker = new WaitlistRanker({
      timeSinceLastFlight: 0,
      timeUntilNextFlight: 0,
      totalHours: 0,
      instructorContinuity: 0,
      aircraftFamiliarity: 0,
    });

    const candidates: WaitlistCandidate[] = [
      makeCandidate({
        studentId: "a",
        studentName: "Alpha",
        signals: {
          timeSinceLastFlight: 100,
          timeUntilNextFlight: 200,
          totalHours: 50,
          instructorContinuity: 1,
          aircraftFamiliarity: 1,
        },
      }),
      makeCandidate({
        studentId: "b",
        studentName: "Beta",
        signals: {
          timeSinceLastFlight: 10,
          timeUntilNextFlight: 20,
          totalHours: 5,
          instructorContinuity: 0,
          aircraftFamiliarity: 0,
        },
      }),
    ];

    const ranked = ranker.rankCandidates(candidates);
    expect(ranked[0].eligibilityScore).toBe(ranked[1].eligibilityScore);
    expect(ranked[0].eligibilityScore).toBe(0);
  });

  it("should return empty array for no candidates", () => {
    const ranker = new WaitlistRanker(equalWeights);
    expect(ranker.rankCandidates([])).toEqual([]);
  });

  // -----------------------------------------------------------------------
  // Custom weights tests
  // -----------------------------------------------------------------------

  describe("custom weights", () => {
    it("should apply enabled custom weights to scoring", () => {
      const customWeights: CustomWeight[] = [
        {
          name: "Total hours bonus",
          signal: "totalHours",
          weight: 5,
          enabled: true,
        },
      ];

      // With custom weight on totalHours, the built-in totalHours weight is overridden
      const ranker = new WaitlistRanker(
        {
          timeSinceLastFlight: 0,
          timeUntilNextFlight: 0,
          totalHours: 1, // this will be overridden
          instructorContinuity: 0,
          aircraftFamiliarity: 0,
        },
        customWeights,
      );

      const candidates: WaitlistCandidate[] = [
        makeCandidate({
          studentId: "low-hours",
          studentName: "Low Hours",
          signals: {
            timeSinceLastFlight: 50,
            timeUntilNextFlight: 50,
            totalHours: 10,
            instructorContinuity: 0,
            aircraftFamiliarity: 0,
          },
        }),
        makeCandidate({
          studentId: "high-hours",
          studentName: "High Hours",
          signals: {
            timeSinceLastFlight: 50,
            timeUntilNextFlight: 50,
            totalHours: 100,
            instructorContinuity: 0,
            aircraftFamiliarity: 0,
          },
        }),
      ];

      const ranked = ranker.rankCandidates(candidates);
      expect(ranked[0].studentName).toBe("High Hours");
    });

    it("should ignore disabled custom weights", () => {
      const customWeights: CustomWeight[] = [
        {
          name: "Disabled weight",
          signal: "totalHours",
          weight: 100,
          enabled: false,
        },
      ];

      const ranker = new WaitlistRanker(
        {
          timeSinceLastFlight: 1,
          timeUntilNextFlight: 0,
          totalHours: 0,
          instructorContinuity: 0,
          aircraftFamiliarity: 0,
        },
        customWeights,
      );

      const candidates: WaitlistCandidate[] = [
        makeCandidate({
          studentId: "a",
          studentName: "Student A",
          signals: {
            timeSinceLastFlight: 100,
            timeUntilNextFlight: 50,
            totalHours: 10,
            instructorContinuity: 0,
            aircraftFamiliarity: 0,
          },
        }),
        makeCandidate({
          studentId: "b",
          studentName: "Student B",
          signals: {
            timeSinceLastFlight: 10,
            timeUntilNextFlight: 50,
            totalHours: 100,
            instructorContinuity: 0,
            aircraftFamiliarity: 0,
          },
        }),
      ];

      // timeSinceLastFlight drives the ranking since custom weight is disabled
      const ranked = ranker.rankCandidates(candidates);
      expect(ranked[0].studentName).toBe("Student A");
    });

    it("should work with empty custom weights array", () => {
      const ranker = new WaitlistRanker(equalWeights, []);

      const candidates: WaitlistCandidate[] = [
        makeCandidate({
          studentId: "a",
          studentName: "Alpha",
          signals: {
            timeSinceLastFlight: 50,
            timeUntilNextFlight: 50,
            totalHours: 20,
            instructorContinuity: 1,
            aircraftFamiliarity: 1,
          },
        }),
      ];

      const ranked = ranker.rankCandidates(candidates);
      expect(ranked).toHaveLength(1);
      expect(ranked[0].eligibilityScore).toBeGreaterThan(0);
    });

    it("should override built-in signal when custom signal matches", () => {
      // Custom weight for daysSinceLastFlight overrides built-in timeSinceLastFlight
      const customWeights: CustomWeight[] = [
        {
          name: "Recency override",
          signal: "daysSinceLastFlight",
          weight: 10,
          enabled: true,
        },
      ];

      const ranker = new WaitlistRanker(
        {
          timeSinceLastFlight: 5, // should be overridden
          timeUntilNextFlight: 0,
          totalHours: 0,
          instructorContinuity: 0,
          aircraftFamiliarity: 0,
        },
        customWeights,
      );

      const candidates: WaitlistCandidate[] = [
        makeCandidate({
          studentId: "a",
          studentName: "Student A",
          signals: {
            timeSinceLastFlight: 240, // 10 days
            timeUntilNextFlight: 50,
            totalHours: 20,
            instructorContinuity: 0,
            aircraftFamiliarity: 0,
          },
        }),
        makeCandidate({
          studentId: "b",
          studentName: "Student B",
          signals: {
            timeSinceLastFlight: 24, // 1 day
            timeUntilNextFlight: 50,
            totalHours: 20,
            instructorContinuity: 0,
            aircraftFamiliarity: 0,
          },
        }),
      ];

      const ranked = ranker.rankCandidates(candidates);
      // Student A has more days since last flight → higher custom score
      expect(ranked[0].studentName).toBe("Student A");
    });
  });
});
