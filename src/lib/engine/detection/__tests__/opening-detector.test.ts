import { describe, it, expect, beforeEach } from "vitest";
import { MockFspClient } from "@/lib/fsp-client/mock";
import { OpeningDetector } from "../opening-detector";

describe("OpeningDetector", () => {
  let fspClient: MockFspClient;
  let detector: OpeningDetector;

  beforeEach(() => {
    fspClient = new MockFspClient();
    detector = new OpeningDetector(fspClient);
  });

  it("should detect gaps in instructor schedule", async () => {
    const result = await detector.detect(1, {
      start: "2026-03-16T00:00:00",
      end: "2026-03-16T23:59:59",
      locationIds: [1],
    });

    expect(result.operatorId).toBe(1);
    // The mock schedule has events for Sarah Chen at 08:00-10:00 and 10:30-12:30 on 3/16
    // There should be gaps: 7:00-8:00 (before first), 10:00-10:30 (between — too short),
    // and 12:30-15:00 (after last, within 8h working day)
    const sarahOpenings = result.openings.filter(
      (o) => o.instructorName === "Sarah Chen",
    );
    expect(sarahOpenings.length).toBeGreaterThan(0);
    expect(sarahOpenings.every((o) => o.source === "gap_analysis")).toBe(true);
  });

  it("should return no openings when schedule is empty", async () => {
    // Create a client that returns empty schedule
    const emptyClient = new MockFspClient();
    // Override getSchedule to return empty
    emptyClient.getSchedule = async () => ({
      results: { events: [], resources: [], unavailability: [] },
    });

    const emptyDetector = new OpeningDetector(emptyClient);
    const result = await emptyDetector.detect(1, {
      start: "2026-03-16T00:00:00",
      end: "2026-03-16T23:59:59",
      locationIds: [1],
    });

    expect(result.openings).toEqual([]);
  });

  it("should create opening from cancellation", () => {
    const opening = detector.openingFromCancellation(
      1,
      "2026-03-16T08:00:00",
      "2026-03-16T10:00:00",
      "Sarah Chen",
      "N12345",
    );

    expect(opening.start).toBe("2026-03-16T08:00:00");
    expect(opening.end).toBe("2026-03-16T10:00:00");
    expect(opening.locationId).toBe(1);
    expect(opening.instructorName).toBe("Sarah Chen");
    expect(opening.aircraftName).toBe("N12345");
    expect(opening.source).toBe("cancellation");
  });

  it("should only detect gaps of at least 60 minutes", async () => {
    const result = await detector.detect(1, {
      start: "2026-03-16T00:00:00",
      end: "2026-03-16T23:59:59",
      locationIds: [1],
    });

    // All detected openings should be at least 60 minutes
    for (const opening of result.openings) {
      const start = new Date(opening.start);
      const end = new Date(opening.end);
      const durationMinutes = (end.getTime() - start.getTime()) / (1000 * 60);
      expect(durationMinutes).toBeGreaterThanOrEqual(60);
    }
  });
});
