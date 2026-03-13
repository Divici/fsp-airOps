import { describe, it, expect, vi, beforeEach } from "vitest";
import { ProposalAssembler } from "../proposal-assembler";
import { buildRationalePrompt } from "../prompts/proposal-rationale";
import type { RationaleContext } from "../types";
import type { ProposalActionInput } from "@/lib/types/workflow";

// Mock the OpenAI client module
vi.mock("../client", () => ({
  getOpenAIClient: vi.fn(),
}));

import { getOpenAIClient } from "../client";

const mockGetClient = vi.mocked(getOpenAIClient);

function makeAction(overrides: Partial<ProposalActionInput> = {}): ProposalActionInput {
  return {
    rank: 1,
    actionType: "create_reservation",
    startTime: new Date("2026-03-14T10:00:00Z"),
    endTime: new Date("2026-03-14T11:00:00Z"),
    locationId: 1,
    studentId: "student-john-smith",
    instructorId: "instructor-jane",
    aircraftId: "aircraft-c172",
    ...overrides,
  };
}

function makeContext(overrides: Partial<RationaleContext> = {}): RationaleContext {
  return {
    workflowType: "reschedule",
    triggerContext: {
      cancelledReservationId: "res-123",
      studentName: "John Smith",
      originalTime: "2026-03-13T14:00:00Z",
    },
    proposedActions: [makeAction(), makeAction({ rank: 2, startTime: new Date("2026-03-14T14:00:00Z"), endTime: new Date("2026-03-14T15:00:00Z") })],
    operatorSettings: { timeZone: "America/New_York" },
    ...overrides,
  };
}

function mockOpenAIResponse(content: string) {
  return {
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [{ message: { content } }],
        }),
      },
    },
  };
}

describe("ProposalAssembler", () => {
  let assembler: ProposalAssembler;

  beforeEach(() => {
    vi.clearAllMocks();
    assembler = new ProposalAssembler();
  });

  it("generates rationale from OpenAI response", async () => {
    const aiResponse = JSON.stringify({
      summary: "Two alternative slots found for John Smith after cancellation.",
      rationale: "The original 2:00 PM slot was cancelled. Two openings were identified on March 14th that match instructor and aircraft availability.",
      actionExplanations: [
        "10:00 AM slot with instructor Jane and C172 is the highest-ranked option.",
        "2:00 PM slot provides an afternoon alternative with the same resources.",
      ],
    });

    mockGetClient.mockReturnValue(mockOpenAIResponse(aiResponse) as never);

    const result = await assembler.generateRationale(makeContext());

    expect(result.summary).toBe("Two alternative slots found for John Smith after cancellation.");
    expect(result.rationale).toContain("original 2:00 PM slot was cancelled");
    expect(result.actionExplanations).toHaveLength(2);
    expect(result.actionExplanations[0]).toContain("10:00 AM");
    expect(result.actionExplanations[1]).toContain("2:00 PM");
  });

  it("falls back gracefully on OpenAI error", async () => {
    mockGetClient.mockReturnValue({
      chat: {
        completions: {
          create: vi.fn().mockRejectedValue(new Error("API rate limit exceeded")),
        },
      },
    } as never);

    const context = makeContext();
    const result = await assembler.generateRationale(context);

    // Should still produce valid output
    expect(result.summary).toBeTruthy();
    expect(result.rationale).toBeTruthy();
    expect(result.actionExplanations).toHaveLength(2);
    // Fallback should mention the workflow-specific prefix
    expect(result.summary).toContain("alternative time slots");
  });

  it("falls back on malformed JSON response", async () => {
    mockGetClient.mockReturnValue(mockOpenAIResponse("not valid json {{{") as never);

    const context = makeContext();
    const result = await assembler.generateRationale(context);

    // Should fall back gracefully
    expect(result.summary).toBeTruthy();
    expect(result.rationale).toBeTruthy();
    expect(result.actionExplanations).toHaveLength(2);
  });

  it("pads actionExplanations when AI returns fewer than expected", async () => {
    const aiResponse = JSON.stringify({
      summary: "Options found.",
      rationale: "Two slots available.",
      actionExplanations: ["Only one explanation provided."],
    });

    mockGetClient.mockReturnValue(mockOpenAIResponse(aiResponse) as never);

    const result = await assembler.generateRationale(makeContext());

    expect(result.actionExplanations).toHaveLength(2);
    expect(result.actionExplanations[0]).toBe("Only one explanation provided.");
    expect(result.actionExplanations[1]).toBe("No explanation available.");
  });

  it("fallback rationale is reasonable for each workflow type", () => {
    const workflowTypes = ["reschedule", "discovery_flight", "next_lesson", "waitlist"] as const;

    for (const wfType of workflowTypes) {
      const context = makeContext({ workflowType: wfType });
      const result = assembler.generateFallbackRationale(context);

      expect(result.summary.length).toBeGreaterThan(10);
      expect(result.rationale).toBe(result.summary);
      expect(result.actionExplanations).toHaveLength(2);
      // Each action explanation should reference the time
      for (const explanation of result.actionExplanations) {
        expect(explanation).toContain("2026-03-14");
      }
    }
  });

  it("calls OpenAI with low temperature and json_object format", async () => {
    const mockCreate = vi.fn().mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ summary: "s", rationale: "r", actionExplanations: ["a", "b"] }) } }],
    });

    mockGetClient.mockReturnValue({
      chat: { completions: { create: mockCreate } },
    } as never);

    await assembler.generateRationale(makeContext());

    expect(mockCreate).toHaveBeenCalledOnce();
    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.model).toBe("gpt-4o");
    expect(callArgs.temperature).toBe(0.3);
    expect(callArgs.response_format).toEqual({ type: "json_object" });
    expect(callArgs.max_tokens).toBe(500);
  });
});

describe("buildRationalePrompt", () => {
  it("includes key context details in the prompt", () => {
    const context = makeContext();
    const prompt = buildRationalePrompt(context);

    // Should mention trigger details
    expect(prompt).toContain("John Smith");
    expect(prompt).toContain("res-123");
    // Should mention action details
    expect(prompt).toContain("student-john-smith");
    expect(prompt).toContain("instructor-jane");
    expect(prompt).toContain("aircraft-c172");
    // Should mention the workflow context
    expect(prompt).toContain("cancelled");
    // Should request correct number of explanations
    expect(prompt).toContain("2 total");
  });

  it("includes additional context when provided", () => {
    const context = makeContext({
      additionalContext: { weatherConditions: "VFR", visibility: "10SM" },
    });
    const prompt = buildRationalePrompt(context);

    expect(prompt).toContain("VFR");
    expect(prompt).toContain("10SM");
  });
});
