import { describe, it, expect } from "vitest";
import { computeDeterministicScore } from "../deterministic-scorer";
import type { AutoApprovalContext } from "../types";

function makeContext(
  overrides: Partial<AutoApprovalContext> = {},
): AutoApprovalContext {
  return {
    proposal: {
      id: "prop-1",
      operatorId: 42,
      workflowType: "reschedule",
      summary: "Reschedule John's lesson",
      rationale: "Original slot cancelled",
      priority: 5,
      actions: [
        {
          rank: 1,
          actionType: "create_reservation",
          startTime: new Date("2026-03-14T10:00:00Z"),
          endTime: new Date("2026-03-14T11:00:00Z"),
          locationId: 1,
          studentId: "student-1",
          instructorId: "instructor-1",
          aircraftId: "aircraft-1",
        },
      ],
      affectedStudentIds: ["student-1"],
    },
    trigger: {
      id: "trigger-1",
      type: "cancellation",
      context: { cancelledReservationId: "res-123" },
    },
    operatorSettings: {
      preferSameInstructor: true,
      preferSameAircraft: true,
      autoApprovalThreshold: 0.8,
    },
    operatorId: 42,
    ...overrides,
  };
}

describe("computeDeterministicScore", () => {
  it("approves low-risk reschedule with full resources", () => {
    const result = computeDeterministicScore(makeContext());

    expect(result.method).toBe("deterministic");
    expect(result.decision).toBe("approve");
    expect(result.confidence).toBeGreaterThanOrEqual(0.8);
    expect(result.toolCalls).toEqual([]);
  });

  it("scores each workflow type with appropriate risk", () => {
    const types = [
      { workflow: "reschedule", expectApprove: true },
      { workflow: "next_lesson", expectApprove: true },
      { workflow: "waitlist", expectApprove: true },
      { workflow: "discovery_flight", expectApprove: false },
    ];

    for (const { workflow, expectApprove } of types) {
      const ctx = makeContext({
        proposal: {
          ...makeContext().proposal,
          workflowType: workflow,
        },
      });
      const result = computeDeterministicScore(ctx);

      if (expectApprove) {
        expect(result.decision).toBe("approve");
      } else {
        expect(result.decision).toBe("defer");
      }
    }
  });

  it("defers when threshold is very high", () => {
    const ctx = makeContext({
      operatorSettings: {
        preferSameInstructor: true,
        preferSameAircraft: true,
        autoApprovalThreshold: 0.99,
      },
    });
    const result = computeDeterministicScore(ctx);

    expect(result.decision).toBe("defer");
  });

  it("approves when threshold is low", () => {
    const ctx = makeContext({
      proposal: {
        ...makeContext().proposal,
        workflowType: "discovery_flight",
      },
      operatorSettings: {
        preferSameInstructor: false,
        preferSameAircraft: false,
        autoApprovalThreshold: 0.3,
      },
    });
    const result = computeDeterministicScore(ctx);

    expect(result.decision).toBe("approve");
  });

  it("increases risk for missing instructor", () => {
    const baseCtx = makeContext();
    const baseResult = computeDeterministicScore(baseCtx);

    const ctx = makeContext({
      proposal: {
        ...makeContext().proposal,
        actions: [
          {
            ...makeContext().proposal.actions[0],
            instructorId: null,
          },
        ],
      },
    });
    const result = computeDeterministicScore(ctx);

    expect(result.confidence).toBeLessThan(baseResult.confidence);
    expect(result.riskFactors).toContain(
      "Action missing instructor assignment",
    );
  });

  it("increases risk for missing aircraft", () => {
    const baseResult = computeDeterministicScore(makeContext());

    const ctx = makeContext({
      proposal: {
        ...makeContext().proposal,
        actions: [
          {
            ...makeContext().proposal.actions[0],
            aircraftId: null,
          },
        ],
      },
    });
    const result = computeDeterministicScore(ctx);

    expect(result.confidence).toBeLessThan(baseResult.confidence);
    expect(result.riskFactors).toContain("Action missing aircraft assignment");
  });

  it("increases risk for multiple actions", () => {
    const baseResult = computeDeterministicScore(makeContext());

    const ctx = makeContext({
      proposal: {
        ...makeContext().proposal,
        actions: [
          makeContext().proposal.actions[0],
          {
            ...makeContext().proposal.actions[0],
            rank: 2,
            startTime: new Date("2026-03-14T14:00:00Z"),
            endTime: new Date("2026-03-14T15:00:00Z"),
          },
        ],
      },
    });
    const result = computeDeterministicScore(ctx);

    expect(result.confidence).toBeLessThan(baseResult.confidence);
  });

  it("mitigates risk for high priority proposals", () => {
    const lowPriority = computeDeterministicScore(
      makeContext({
        proposal: { ...makeContext().proposal, priority: 3 },
      }),
    );
    const highPriority = computeDeterministicScore(
      makeContext({
        proposal: { ...makeContext().proposal, priority: 9 },
      }),
    );

    expect(highPriority.confidence).toBeGreaterThan(lowPriority.confidence);
    expect(highPriority.mitigations).toEqual(
      expect.arrayContaining([expect.stringContaining("High priority")]),
    );
  });

  it("clamps confidence between 0 and 1", () => {
    // Even with stacked risk factors, confidence should not go below 0
    const ctx = makeContext({
      proposal: {
        ...makeContext().proposal,
        workflowType: "unknown_type",
        actions: [
          {
            ...makeContext().proposal.actions[0],
            instructorId: null,
            aircraftId: null,
          },
          {
            ...makeContext().proposal.actions[0],
            rank: 2,
            instructorId: null,
            aircraftId: null,
          },
        ],
      },
    });
    const result = computeDeterministicScore(ctx);

    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  it("includes reasoning in the decision", () => {
    const result = computeDeterministicScore(makeContext());

    expect(result.reasoning).toContain("risk");
    expect(result.reasoning).toContain("Reschedule");
  });
});
