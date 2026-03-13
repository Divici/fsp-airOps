import { describe, it, expect } from "vitest";
import { WorkflowRegistry, triggerToWorkflow } from "../workflow-registry";
import type { WorkflowHandler } from "../types";
import type { WorkflowContext, WorkflowResult } from "@/lib/types/workflow";

function makeMockHandler(
  type: WorkflowHandler["type"]
): WorkflowHandler {
  return {
    type,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    execute: async (_ctx: WorkflowContext): Promise<WorkflowResult> => ({
      proposedActions: [],
      summary: `mock ${type}`,
      rawData: null,
    }),
  };
}

describe("WorkflowRegistry", () => {
  it("registers and retrieves a handler", () => {
    const registry = new WorkflowRegistry();
    const handler = makeMockHandler("reschedule");

    registry.register(handler);

    expect(registry.getHandler("reschedule")).toBe(handler);
    expect(registry.hasHandler("reschedule")).toBe(true);
  });

  it("returns undefined for unknown type", () => {
    const registry = new WorkflowRegistry();

    expect(registry.getHandler("reschedule")).toBeUndefined();
    expect(registry.hasHandler("reschedule")).toBe(false);
  });

  it("lists all registered types", () => {
    const registry = new WorkflowRegistry();
    registry.register(makeMockHandler("reschedule"));
    registry.register(makeMockHandler("waitlist"));

    const types = registry.getRegisteredTypes();
    expect(types).toHaveLength(2);
    expect(types).toContain("reschedule");
    expect(types).toContain("waitlist");
  });

  it("overwrites handler when registering same type twice", () => {
    const registry = new WorkflowRegistry();
    const first = makeMockHandler("reschedule");
    const second = makeMockHandler("reschedule");

    registry.register(first);
    registry.register(second);

    expect(registry.getHandler("reschedule")).toBe(second);
    expect(registry.getRegisteredTypes()).toHaveLength(1);
  });
});

describe("triggerToWorkflow", () => {
  it("maps cancellation to reschedule", () => {
    expect(triggerToWorkflow("cancellation")).toBe("reschedule");
  });

  it("maps discovery_request to discovery_flight", () => {
    expect(triggerToWorkflow("discovery_request")).toBe("discovery_flight");
  });

  it("maps lesson_complete to next_lesson", () => {
    expect(triggerToWorkflow("lesson_complete")).toBe("next_lesson");
  });

  it("maps opening_detected to waitlist", () => {
    expect(triggerToWorkflow("opening_detected")).toBe("waitlist");
  });

  it("returns null for manual trigger", () => {
    expect(triggerToWorkflow("manual")).toBeNull();
  });
});
