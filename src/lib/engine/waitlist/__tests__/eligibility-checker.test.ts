import { describe, it, expect, beforeEach } from "vitest";
import { MockFspClient } from "@/lib/fsp-client/mock";
import { EligibilityChecker } from "../eligibility-checker";

describe("EligibilityChecker", () => {
  let fspClient: MockFspClient;
  let checker: EligibilityChecker;

  beforeEach(() => {
    fspClient = new MockFspClient();
    checker = new EligibilityChecker(fspClient);
  });

  it("should return eligible for student with active enrollment and no conflict", async () => {
    // Alex Rivera (stu-aaa-1111) has active enrollment
    // Check a time slot that doesn't conflict with their existing reservations
    const result = await checker.checkEligibility(
      1,
      "stu-aaa-1111",
      new Date("2026-03-25T08:00:00"),
      new Date("2026-03-25T10:00:00"),
    );

    expect(result.eligible).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it("should return ineligible when student has a conflicting reservation", async () => {
    // Alex Rivera has a reservation on 2026-03-16T08:00–10:00
    const result = await checker.checkEligibility(
      1,
      "stu-aaa-1111",
      new Date("2026-03-16T09:00:00"),
      new Date("2026-03-16T11:00:00"),
    );

    expect(result.eligible).toBe(false);
    expect(result.reason).toBe("Conflicting reservation");
  });

  it("should return ineligible when student has no active enrollment", async () => {
    // Morgan Patel (stu-ddd-4444) has no enrollment records
    const result = await checker.checkEligibility(
      1,
      "stu-ddd-4444",
      new Date("2026-03-25T08:00:00"),
      new Date("2026-03-25T10:00:00"),
    );

    expect(result.eligible).toBe(false);
    expect(result.reason).toBe("No active enrollment");
  });

  it("should return eligible when reservations exist but no overlap", async () => {
    // Jamie Nguyen (stu-bbb-2222) has reservation 10:30–12:30 on 3/16
    // Check 14:00–16:00 — no overlap
    const result = await checker.checkEligibility(
      1,
      "stu-bbb-2222",
      new Date("2026-03-16T14:00:00"),
      new Date("2026-03-16T16:00:00"),
    );

    expect(result.eligible).toBe(true);
  });
});
