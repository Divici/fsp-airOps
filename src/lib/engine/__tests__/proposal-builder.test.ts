import { describe, it, expect, vi, beforeEach } from "vitest";
import { ProposalBuilder } from "../proposal-builder";
import type { WorkflowResult } from "@/lib/types/workflow";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

// Mock the createProposal function
vi.mock("@/lib/db/queries/proposals", () => ({
  createProposal: vi.fn(),
}));

import { createProposal } from "@/lib/db/queries/proposals";

const mockCreateProposal = vi.mocked(createProposal);

describe("ProposalBuilder", () => {
  const mockDb = {} as PostgresJsDatabase;
  let builder: ProposalBuilder;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateProposal.mockResolvedValue({
      proposalId: "proposal-123",
      actionIds: ["action-1"],
    });
    builder = new ProposalBuilder(mockDb);
  });

  function makeWorkflowResult(
    overrides: Partial<WorkflowResult> = {}
  ): WorkflowResult {
    return {
      summary: "Test summary",
      rawData: null,
      proposedActions: [
        {
          rank: 1,
          actionType: "create_reservation",
          startTime: new Date("2026-03-14T10:00:00Z"),
          endTime: new Date("2026-03-14T11:00:00Z"),
          locationId: 1,
          studentId: "student-1",
          instructorId: "instructor-1",
          aircraftId: "aircraft-1",
          explanation: "Best available slot",
        },
      ],
      ...overrides,
    };
  }

  it("returns the proposal ID from createProposal", async () => {
    const result = await builder.buildAndPersist({
      operatorId: 42,
      workflowType: "reschedule",
      triggerId: "trigger-abc",
      result: makeWorkflowResult(),
    });

    expect(result).toBe("proposal-123");
  });

  it("passes correct data to createProposal", async () => {
    const workflowResult = makeWorkflowResult();

    await builder.buildAndPersist({
      operatorId: 42,
      workflowType: "reschedule",
      triggerId: "trigger-abc",
      result: workflowResult,
    });

    expect(mockCreateProposal).toHaveBeenCalledOnce();
    const callArgs = mockCreateProposal.mock.calls[0];
    expect(callArgs[0]).toBe(mockDb);

    const params = callArgs[1];
    expect(params.operatorId).toBe(42);
    expect(params.workflowType).toBe("reschedule");
    expect(params.triggerId).toBe("trigger-abc");
    expect(params.summary).toBe("Test summary");
    // status is hardcoded to 'pending' inside createProposal, not a param
    expect(params.actions).toHaveLength(1);
    expect(params.actions[0].rank).toBe(1);
    expect(params.actions[0].studentId).toBe("student-1");
  });

  it("sets default expiration to 24 hours from now", async () => {
    const before = Date.now();

    await builder.buildAndPersist({
      operatorId: 42,
      workflowType: "reschedule",
      triggerId: "trigger-abc",
      result: makeWorkflowResult(),
    });

    const after = Date.now();
    const params = mockCreateProposal.mock.calls[0][1];
    const expiresAt = params.expiresAt!.getTime();

    // Should be ~24 hours from now (within a small tolerance)
    const twentyFourHours = 24 * 60 * 60 * 1000;
    expect(expiresAt).toBeGreaterThanOrEqual(before + twentyFourHours - 100);
    expect(expiresAt).toBeLessThanOrEqual(after + twentyFourHours + 100);
  });

  it("respects custom expiresInHours", async () => {
    const before = Date.now();

    await builder.buildAndPersist({
      operatorId: 42,
      workflowType: "reschedule",
      triggerId: "trigger-abc",
      result: makeWorkflowResult(),
      expiresInHours: 48,
    });

    const params = mockCreateProposal.mock.calls[0][1];
    const expiresAt = params.expiresAt!.getTime();
    const fortyEightHours = 48 * 60 * 60 * 1000;
    expect(expiresAt).toBeGreaterThanOrEqual(before + fortyEightHours - 100);
  });

  it("sets priority based on workflow type", async () => {
    // reschedule = 80
    await builder.buildAndPersist({
      operatorId: 42,
      workflowType: "reschedule",
      triggerId: "trigger-abc",
      result: makeWorkflowResult(),
    });

    expect(mockCreateProposal.mock.calls[0][1].priority).toBe(80);

    vi.clearAllMocks();
    mockCreateProposal.mockResolvedValue({
      proposalId: "p2",
      actionIds: [],
    });

    // waitlist = 20
    await builder.buildAndPersist({
      operatorId: 42,
      workflowType: "waitlist",
      triggerId: "trigger-xyz",
      result: makeWorkflowResult(),
    });

    expect(mockCreateProposal.mock.calls[0][1].priority).toBe(20);
  });

  it("collects affected student and resource IDs from actions", async () => {
    const result = makeWorkflowResult({
      proposedActions: [
        {
          rank: 1,
          actionType: "create_reservation",
          startTime: new Date(),
          endTime: new Date(),
          locationId: 1,
          studentId: "s1",
          instructorId: "i1",
          aircraftId: "a1",
        },
        {
          rank: 2,
          actionType: "reschedule",
          startTime: new Date(),
          endTime: new Date(),
          locationId: 1,
          studentId: "s2",
          instructorId: "i1", // duplicate instructor
        },
      ],
    });

    await builder.buildAndPersist({
      operatorId: 42,
      workflowType: "next_lesson",
      triggerId: "t1",
      result,
    });

    const params = mockCreateProposal.mock.calls[0][1];
    expect(params.affectedStudentIds).toEqual(
      expect.arrayContaining(["s1", "s2"])
    );
    expect(params.affectedStudentIds).toHaveLength(2);
    // i1 appears twice but should be deduplicated, a1 also included
    expect(params.affectedResourceIds).toEqual(
      expect.arrayContaining(["i1", "a1"])
    );
    expect(params.affectedResourceIds).toHaveLength(2);
  });

  it("uses rationale override when provided", async () => {
    await builder.buildAndPersist({
      operatorId: 42,
      workflowType: "reschedule",
      triggerId: "t1",
      result: makeWorkflowResult(),
      rationale: "Custom rationale",
    });

    expect(mockCreateProposal.mock.calls[0][1].rationale).toBe(
      "Custom rationale"
    );
  });

  it("falls back to summary as rationale when not provided", async () => {
    await builder.buildAndPersist({
      operatorId: 42,
      workflowType: "reschedule",
      triggerId: "t1",
      result: makeWorkflowResult({ summary: "My summary" }),
    });

    expect(mockCreateProposal.mock.calls[0][1].rationale).toBe("My summary");
  });
});
