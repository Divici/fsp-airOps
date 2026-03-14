import { describe, it, expect, beforeEach } from "vitest";
import { MockFspClient } from "@/lib/fsp-client/mock";
import { WaitlistWorkflowHandler } from "../../workflows/waitlist";
import type { WorkflowContext } from "@/lib/types/workflow";
import type { SchedulingTrigger, OperatorSettings } from "@/lib/db/schema";
import { DEFAULT_OPERATOR_SETTINGS } from "@/config/defaults";
import type { WaitlistWorkflowContext } from "../../workflows/waitlist.types";

function makeTrigger(
  context: WaitlistWorkflowContext | null,
): SchedulingTrigger {
  return {
    id: "trigger-001",
    operatorId: 1,
    type: "opening_detected",
    status: "processing",
    sourceEntityId: "res-cancelled",
    sourceEntityType: "reservation",
    context: context as unknown as Record<string, unknown>,
    error: null,
    processedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function makeSettings(): OperatorSettings {
  return {
    id: "settings-001",
    operatorId: 1,
    ...DEFAULT_OPERATOR_SETTINGS,
    enabledWorkflows: { ...DEFAULT_OPERATOR_SETTINGS.enabledWorkflows },
    communicationPreferences: {
      ...DEFAULT_OPERATOR_SETTINGS.communicationPreferences,
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe("WaitlistWorkflowHandler", () => {
  let fspClient: MockFspClient;
  let handler: WaitlistWorkflowHandler;

  beforeEach(() => {
    fspClient = new MockFspClient();
    handler = new WaitlistWorkflowHandler(fspClient);
  });

  it("should have type 'waitlist'", () => {
    expect(handler.type).toBe("waitlist");
  });

  it("should return empty actions when no context provided", async () => {
    const context: WorkflowContext = {
      operatorId: 1,
      trigger: makeTrigger(null),
      settings: makeSettings(),
    };

    const result = await handler.execute(context);
    expect(result.proposedActions).toEqual([]);
    expect(result.summary).toContain("No opening context");
  });

  it("should find and rank candidates for a valid opening", async () => {
    const openingCtx: WaitlistWorkflowContext = {
      openingStart: "2026-03-16T08:00:00",
      openingEnd: "2026-03-22T18:00:00",
      locationId: 1,
      activityTypeId: "at-1",
    };

    const context: WorkflowContext = {
      operatorId: 1,
      trigger: makeTrigger(openingCtx),
      settings: makeSettings(),
    };

    const result = await handler.execute(context);

    // Should produce at least one proposed action
    expect(result.proposedActions.length).toBeGreaterThan(0);
    expect(result.summary).toContain("waitlist candidates");

    // Each proposed action should have required fields
    for (const action of result.proposedActions) {
      expect(action.actionType).toBe("create_reservation");
      expect(action.studentId).toBeTruthy();
      expect(action.startTime).toBeInstanceOf(Date);
      expect(action.endTime).toBeInstanceOf(Date);
      expect(action.rank).toBeGreaterThan(0);
    }
  });

  it("should return empty actions when no candidates match", async () => {
    const openingCtx: WaitlistWorkflowContext = {
      openingStart: "2026-03-16T08:00:00",
      openingEnd: "2026-03-22T18:00:00",
      locationId: 1,
      activityTypeId: "nonexistent-type",
    };

    const context: WorkflowContext = {
      operatorId: 1,
      trigger: makeTrigger(openingCtx),
      settings: makeSettings(),
    };

    const result = await handler.execute(context);
    expect(result.proposedActions).toEqual([]);
    expect(result.summary).toContain("No eligible candidates");
  });

  it("should respect topNAlternatives setting", async () => {
    const settings = makeSettings();
    settings.topNAlternatives = 2;

    const openingCtx: WaitlistWorkflowContext = {
      openingStart: "2026-03-16T08:00:00",
      openingEnd: "2026-03-22T18:00:00",
      locationId: 1,
      activityTypeId: "at-1",
    };

    const context: WorkflowContext = {
      operatorId: 1,
      trigger: makeTrigger(openingCtx),
      settings,
    };

    const result = await handler.execute(context);
    expect(result.proposedActions.length).toBeLessThanOrEqual(2);
  });

  it("should return empty when no slots available", async () => {
    fspClient.setScenario("no_available_slots");

    const openingCtx: WaitlistWorkflowContext = {
      openingStart: "2026-03-16T08:00:00",
      openingEnd: "2026-03-22T18:00:00",
      locationId: 1,
      activityTypeId: "at-1",
    };

    const context: WorkflowContext = {
      operatorId: 1,
      trigger: makeTrigger(openingCtx),
      settings: makeSettings(),
    };

    const result = await handler.execute(context);
    // Candidates may exist but no slots found — so no proposed actions
    expect(result.proposedActions).toEqual([]);
  });
});
