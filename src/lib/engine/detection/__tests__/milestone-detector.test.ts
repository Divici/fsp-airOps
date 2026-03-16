import { describe, it, expect, beforeEach, vi } from "vitest";
import { MockFspClient } from "@/lib/fsp-client/mock";
import { MilestoneDetector } from "../milestone-detector";

const OPERATOR_ID = 1;

describe("MilestoneDetector", () => {
  let mockClient: MockFspClient;
  let detector: MilestoneDetector;

  beforeEach(() => {
    mockClient = new MockFspClient();
    detector = new MilestoneDetector(mockClient);
  });

  it("does not flag early-stage students", async () => {
    // Default mock data: stu-aaa-1111 has 7/35 (20%), stu-bbb-2222 has 9/35 (26%),
    // stu-ccc-3333 has 5/25 (20%) — all below 80%
    const results = await detector.detectMilestoneStudents(OPERATOR_ID);

    const names = results.map((s) => s.studentName);
    expect(names).not.toContain("Dave AIhe");
    expect(names).not.toContain("Jamie Nguyen");
    expect(names).not.toContain("Taylor Kim");
  });

  it("does not flag students without enrollments", async () => {
    // stu-ddd-4444 (Morgan Patel) and stu-fff-6666 (Jordan Lee) have no enrollments
    const results = await detector.detectMilestoneStudents(OPERATOR_ID);

    const ids = results.map((s) => s.studentId);
    expect(ids).not.toContain("stu-ddd-4444");
    expect(ids).not.toContain("stu-fff-6666");
  });

  it("flags students near completion (>= 80%)", async () => {
    // Override enrollment progress to make a student near completion
    vi.spyOn(mockClient, "getEnrollmentProgress").mockImplementation(
      async (_operatorId, enrollmentId) => {
        if (enrollmentId === "enr-001") {
          return {
            enrollmentId: "enr-001",
            completedLessons: 30,
            totalLessons: 35,
            completedFlightHours: 35.0,
            requiredFlightHours: 40,
          };
        }
        // Return default low progress for others
        return {
          enrollmentId,
          completedLessons: 2,
          totalLessons: 35,
          completedFlightHours: 4.0,
          requiredFlightHours: 40,
        };
      },
    );

    const results = await detector.detectMilestoneStudents(OPERATOR_ID);

    const dave = results.find((s) => s.studentId === "stu-aaa-1111");
    expect(dave).toBeDefined();
    expect(dave!.completedLessons).toBe(30);
    expect(dave!.totalLessons).toBe(35);
    expect(dave!.percentComplete).toBeCloseTo(0.86, 1);
    expect(dave!.currentStage).toBe("Private Pilot License");
  });

  it("computes percentComplete correctly", async () => {
    vi.spyOn(mockClient, "getEnrollmentProgress").mockImplementation(
      async (_operatorId, enrollmentId) => {
        if (enrollmentId === "enr-001") {
          return {
            enrollmentId: "enr-001",
            completedLessons: 28,
            totalLessons: 35,
            completedFlightHours: 32.0,
            requiredFlightHours: 40,
          };
        }
        return {
          enrollmentId,
          completedLessons: 1,
          totalLessons: 35,
          completedFlightHours: 2.0,
          requiredFlightHours: 40,
        };
      },
    );

    const results = await detector.detectMilestoneStudents(OPERATOR_ID);
    const dave = results.find((s) => s.studentId === "stu-aaa-1111");
    expect(dave).toBeDefined();
    // 28/35 = 0.8
    expect(dave!.percentComplete).toBe(0.8);
  });

  it("marks isCheckrideReady when percentComplete >= 90%", async () => {
    vi.spyOn(mockClient, "getEnrollmentProgress").mockImplementation(
      async (_operatorId, enrollmentId) => {
        if (enrollmentId === "enr-001") {
          return {
            enrollmentId: "enr-001",
            completedLessons: 32,
            totalLessons: 35,
            completedFlightHours: 38.0,
            requiredFlightHours: 40,
          };
        }
        return {
          enrollmentId,
          completedLessons: 1,
          totalLessons: 35,
          completedFlightHours: 2.0,
          requiredFlightHours: 40,
        };
      },
    );

    const results = await detector.detectMilestoneStudents(OPERATOR_ID);
    const dave = results.find((s) => s.studentId === "stu-aaa-1111");
    expect(dave).toBeDefined();
    // 32/35 = 0.914...
    expect(dave!.isCheckrideReady).toBe(true);
  });

  it("marks isCheckrideReady when on final lesson", async () => {
    vi.spyOn(mockClient, "getEnrollmentProgress").mockImplementation(
      async (_operatorId, enrollmentId) => {
        if (enrollmentId === "enr-001") {
          return {
            enrollmentId: "enr-001",
            completedLessons: 29,
            totalLessons: 35,
            completedFlightHours: 34.0,
            requiredFlightHours: 40,
          };
        }
        return {
          enrollmentId,
          completedLessons: 1,
          totalLessons: 35,
          completedFlightHours: 2.0,
          requiredFlightHours: 40,
        };
      },
    );

    const results = await detector.detectMilestoneStudents(OPERATOR_ID);
    const dave = results.find((s) => s.studentId === "stu-aaa-1111");
    expect(dave).toBeDefined();
    // 29/35 = 0.828... but remaining = 6, so not on final lesson
    // percentComplete < 0.9, so NOT checkride ready
    expect(dave!.isCheckrideReady).toBe(false);

    // Now test with remaining = 1 (on final lesson)
    vi.spyOn(mockClient, "getEnrollmentProgress").mockImplementation(
      async (_operatorId, eid) => {
        if (eid === "enr-001") {
          return {
            enrollmentId: "enr-001",
            completedLessons: 34,
            totalLessons: 35,
            completedFlightHours: 39.0,
            requiredFlightHours: 40,
          };
        }
        return {
          enrollmentId: eid,
          completedLessons: 1,
          totalLessons: 35,
          completedFlightHours: 2.0,
          requiredFlightHours: 40,
        };
      },
    );

    const results2 = await detector.detectMilestoneStudents(OPERATOR_ID);
    const dave2 = results2.find((s) => s.studentId === "stu-aaa-1111");
    expect(dave2).toBeDefined();
    // 34/35 = 0.971... >= 0.9, so checkride ready
    expect(dave2!.isCheckrideReady).toBe(true);
  });

  it("skips enrollments with zero total lessons", async () => {
    vi.spyOn(mockClient, "getEnrollmentProgress").mockResolvedValue({
      enrollmentId: "enr-001",
      completedLessons: 0,
      totalLessons: 0,
      completedFlightHours: 0,
      requiredFlightHours: 0,
    });

    const results = await detector.detectMilestoneStudents(OPERATOR_ID);
    expect(results).toHaveLength(0);
  });

  it("skips enrollments when progress lookup throws", async () => {
    vi.spyOn(mockClient, "getEnrollmentProgress").mockRejectedValue(
      new Error("Not found"),
    );

    const results = await detector.detectMilestoneStudents(OPERATOR_ID);
    // Should not throw — just returns no milestone students
    expect(results).toHaveLength(0);
  });
});
