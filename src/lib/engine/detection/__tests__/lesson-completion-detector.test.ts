import { describe, it, expect, beforeEach } from "vitest";
import type { FspSchedulableEvent } from "@/lib/types/fsp";
import { MockFspClient } from "@/lib/fsp-client/mock";
import {
  createLessonSnapshot,
  compareLessonSnapshots,
  LessonCompletionDetector,
} from "../lesson-completion-detector";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEvent(
  overrides: Partial<FspSchedulableEvent> = {},
): FspSchedulableEvent {
  return {
    eventId: "evt-001",
    enrollmentId: "enr-001",
    studentId: "stu-aaa-1111",
    studentFirstName: "Alex",
    studentLastName: "Rivera",
    courseId: "crs-ppl",
    courseName: "Private Pilot License",
    lessonId: "les-ppl-08",
    lessonName: "PPL Lesson 8 - Slow Flight & Stalls",
    lessonOrder: 8,
    flightType: 0,
    routeType: 0,
    timeOfDay: 1,
    durationTotal: 120,
    aircraftDurationTotal: 90,
    instructorDurationPre: 15,
    instructorDurationPost: 15,
    instructorDurationTotal: 120,
    instructorRequired: true,
    instructorIds: ["inst-aaa-1111"],
    aircraftIds: ["ac-1"],
    schedulingGroupIds: [],
    meetingRoomIds: [],
    isStageCheck: false,
    reservationTypeId: "rt-1",
    activityTypeId: "at-1",
    ...overrides,
  };
}

const OPERATOR_ID = 1;

// ---------------------------------------------------------------------------
// Snapshot comparison tests
// ---------------------------------------------------------------------------

describe("compareLessonSnapshots", () => {
  it("returns empty when both snapshots are identical", () => {
    const events = [makeEvent()];
    const prev = createLessonSnapshot(OPERATOR_ID, events);
    const curr = createLessonSnapshot(OPERATOR_ID, events);

    const completions = compareLessonSnapshots(prev, curr);

    expect(completions).toHaveLength(0);
  });

  it("detects completed events (present in previous, absent in current)", () => {
    const evt1 = makeEvent({ eventId: "evt-001" });
    const evt2 = makeEvent({ eventId: "evt-002" });

    const prev = createLessonSnapshot(OPERATOR_ID, [evt1, evt2]);
    const curr = createLessonSnapshot(OPERATOR_ID, [evt1]); // evt-002 completed

    const completions = compareLessonSnapshots(prev, curr);

    expect(completions).toHaveLength(1);
    expect(completions[0].eventId).toBe("evt-002");
    expect(completions[0].studentName).toBe("Alex Rivera");
  });

  it("handles empty previous snapshot (no completions)", () => {
    const evt1 = makeEvent({ eventId: "evt-001" });
    const prev = createLessonSnapshot(OPERATOR_ID, []);
    const curr = createLessonSnapshot(OPERATOR_ID, [evt1]);

    const completions = compareLessonSnapshots(prev, curr);

    expect(completions).toHaveLength(0);
  });

  it("handles empty current snapshot (all completed)", () => {
    const evt1 = makeEvent({ eventId: "evt-001" });
    const prev = createLessonSnapshot(OPERATOR_ID, [evt1]);
    const curr = createLessonSnapshot(OPERATOR_ID, []);

    const completions = compareLessonSnapshots(prev, curr);

    expect(completions).toHaveLength(1);
    expect(completions[0].eventId).toBe("evt-001");
  });

  it("detects multiple completions", () => {
    const evt1 = makeEvent({ eventId: "evt-001" });
    const evt2 = makeEvent({ eventId: "evt-002" });
    const evt3 = makeEvent({ eventId: "evt-003" });

    const prev = createLessonSnapshot(OPERATOR_ID, [evt1, evt2, evt3]);
    const curr = createLessonSnapshot(OPERATOR_ID, [evt2]); // evt-001 and evt-003 completed

    const completions = compareLessonSnapshots(prev, curr);

    expect(completions).toHaveLength(2);
    const ids = completions.map((c) => c.eventId);
    expect(ids).toContain("evt-001");
    expect(ids).toContain("evt-003");
  });

  it("includes correct enrollment and course details", () => {
    const evt = makeEvent({
      eventId: "evt-001",
      enrollmentId: "enr-005",
      courseId: "crs-ir",
      courseName: "Instrument Rating",
      lessonId: "les-ir-06",
      lessonName: "IR Lesson 6 - ILS Approaches",
      lessonOrder: 6,
    });

    const prev = createLessonSnapshot(OPERATOR_ID, [evt]);
    const curr = createLessonSnapshot(OPERATOR_ID, []);

    const completions = compareLessonSnapshots(prev, curr);

    expect(completions[0].enrollmentId).toBe("enr-005");
    expect(completions[0].courseId).toBe("crs-ir");
    expect(completions[0].courseName).toBe("Instrument Rating");
    expect(completions[0].lessonId).toBe("les-ir-06");
    expect(completions[0].lessonOrder).toBe(6);
  });
});

// ---------------------------------------------------------------------------
// LessonCompletionDetector tests
// ---------------------------------------------------------------------------

describe("LessonCompletionDetector", () => {
  let mockClient: MockFspClient;
  let detector: LessonCompletionDetector;

  const queryParams = {
    startDate: "2026-03-16",
    endDate: "2026-03-23",
    locationId: 1,
  };

  beforeEach(() => {
    mockClient = new MockFspClient();
    detector = new LessonCompletionDetector(mockClient);
  });

  it("fetchSnapshot returns a snapshot of current schedulable events", async () => {
    const snapshot = await detector.fetchSnapshot(OPERATOR_ID, queryParams);

    expect(snapshot.operatorId).toBe(OPERATOR_ID);
    expect(snapshot.events.size).toBeGreaterThan(0);
    expect(snapshot.capturedAt).toBeInstanceOf(Date);
  });

  it("detect returns no completions when nothing changed", async () => {
    const baseline = await detector.fetchSnapshot(OPERATOR_ID, queryParams);
    const result = await detector.detect(OPERATOR_ID, baseline, queryParams);

    expect(result.completions).toHaveLength(0);
  });

  it("detect returns updated snapshot for next cycle", async () => {
    // Create a baseline with known events
    const events = [makeEvent({ eventId: "evt-x" })];
    const baseline = createLessonSnapshot(OPERATOR_ID, events);

    // Current FSP state has different events (the mock returns its fixed set)
    const result = await detector.detect(OPERATOR_ID, baseline, queryParams);

    // evt-x is not in mock data, so it should appear as completed
    expect(result.completions.some((c) => c.eventId === "evt-x")).toBe(true);

    // The new snapshot should reflect the current mock data
    expect(result.currentSnapshot.events.size).toBeGreaterThan(0);
    expect(result.currentSnapshot.capturedAt).toBeInstanceOf(Date);
  });
});
