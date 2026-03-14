import { describe, it, expect, beforeEach } from "vitest";
import { MockFspClient } from "@/lib/fsp-client/mock";
import { CandidateFinder } from "../candidate-finder";
import type { OpeningConstraints } from "../types";

describe("CandidateFinder", () => {
  let fspClient: MockFspClient;
  let finder: CandidateFinder;

  beforeEach(() => {
    fspClient = new MockFspClient();
    finder = new CandidateFinder(fspClient);
  });

  const baseConstraints: OpeningConstraints = {
    timeWindow: {
      start: new Date("2026-03-16T08:00:00"),
      end: new Date("2026-03-22T18:00:00"),
    },
    locationId: 1,
  };

  it("should find candidates matching constraints", async () => {
    const candidates = await finder.findCandidates(1, baseConstraints);

    // Should find students with schedulable events and active enrollments
    expect(candidates.length).toBeGreaterThan(0);

    // Each candidate should have required fields
    for (const c of candidates) {
      expect(c.studentId).toBeTruthy();
      expect(c.studentName).toBeTruthy();
      expect(c.enrollmentId).toBeTruthy();
      expect(c.nextEventId).toBeTruthy();
      expect(c.signals).toBeDefined();
    }
  });

  it("should filter by activity type when specified", async () => {
    const constraints: OpeningConstraints = {
      ...baseConstraints,
      activityTypeId: "at-3", // Ground school only
    };

    const candidates = await finder.findCandidates(1, constraints);

    // Only Alex Rivera has a ground school event (at-3)
    expect(candidates.length).toBeLessThanOrEqual(1);
    if (candidates.length > 0) {
      expect(candidates[0].studentName).toBe("Alex Rivera");
    }
  });

  it("should return empty array when no matching candidates exist", async () => {
    const constraints: OpeningConstraints = {
      ...baseConstraints,
      activityTypeId: "nonexistent-activity",
    };

    const candidates = await finder.findCandidates(1, constraints);
    expect(candidates).toEqual([]);
  });

  it("should exclude students without active enrollment", async () => {
    const candidates = await finder.findCandidates(1, baseConstraints);

    // Morgan Patel (stu-ddd-4444) has no enrollment, so should not appear
    const morgan = candidates.find((c) => c.studentId === "stu-ddd-4444");
    expect(morgan).toBeUndefined();
  });

  it("should populate signal values for each candidate", async () => {
    const candidates = await finder.findCandidates(1, baseConstraints);

    for (const c of candidates) {
      expect(typeof c.signals.timeSinceLastFlight).toBe("number");
      expect(typeof c.signals.timeUntilNextFlight).toBe("number");
      expect(typeof c.signals.totalHours).toBe("number");
      expect(c.signals.totalHours).toBeGreaterThanOrEqual(0);
      expect(c.signals.instructorContinuity).toBeGreaterThanOrEqual(0);
      expect(c.signals.instructorContinuity).toBeLessThanOrEqual(1);
      expect(c.signals.aircraftFamiliarity).toBeGreaterThanOrEqual(0);
      expect(c.signals.aircraftFamiliarity).toBeLessThanOrEqual(1);
    }
  });
});
