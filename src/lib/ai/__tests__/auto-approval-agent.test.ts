import { describe, it, expect, vi, beforeEach } from "vitest";
import { AutoApprovalAgent } from "../auto-approval-agent";
import type { AutoApprovalContext } from "../types";
import type { IFspClient } from "@/lib/fsp-client";

// Mock the OpenAI client module
vi.mock("../client", () => ({
  getOpenAIClient: vi.fn(),
}));

import { getOpenAIClient } from "../client";

const mockGetClient = vi.mocked(getOpenAIClient);

function makeContext(): AutoApprovalContext {
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
  };
}

function makeMockFspClient(): IFspClient {
  return {
    authenticate: vi.fn(),
    refreshSession: vi.fn(),
    getLocations: vi.fn(),
    getAircraft: vi.fn(),
    getInstructors: vi.fn(),
    getActivityTypes: vi.fn(),
    getSchedulingGroups: vi.fn(),
    getUsers: vi.fn(),
    getAvailability: vi.fn(),
    getSchedule: vi.fn().mockResolvedValue({
      results: { events: [], resources: [], unavailability: [] },
    }),
    getSchedulableEvents: vi.fn(),
    findATime: vi.fn(),
    autoSchedule: vi.fn(),
    validateReservation: vi.fn(),
    createReservation: vi.fn(),
    getReservation: vi.fn(),
    listReservations: vi.fn().mockResolvedValue([]),
    getEnrollments: vi.fn().mockResolvedValue([]),
    getEnrollmentProgress: vi.fn(),
    getCivilTwilight: vi.fn(),
  } as unknown as IFspClient;
}

describe("AutoApprovalAgent", () => {
  let agent: AutoApprovalAgent;
  let mockFspClient: IFspClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mockFspClient = makeMockFspClient();
    agent = new AutoApprovalAgent(mockFspClient);
  });

  it("returns AI decision when OpenAI responds without tool calls", async () => {
    const aiResponse = JSON.stringify({
      decision: "approve",
      confidence: 0.92,
      reasoning: "Low risk reschedule with same instructor.",
      riskFactors: [],
      mitigations: ["Same instructor continuity"],
    });

    mockGetClient.mockReturnValue({
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [
              {
                message: {
                  content: aiResponse,
                  tool_calls: null,
                },
              },
            ],
          }),
        },
      },
    } as never);

    const result = await agent.evaluate(makeContext());

    expect(result.method).toBe("ai");
    expect(result.decision).toBe("approve");
    expect(result.confidence).toBe(0.92);
    expect(result.reasoning).toContain("Low risk");
  });

  it("executes tool calls in the agent loop", async () => {
    const mockCreate = vi
      .fn()
      // First call: AI requests a tool call
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: null,
              tool_calls: [
                {
                  id: "call-1",
                  type: "function",
                  function: {
                    name: "getWeather",
                    arguments: JSON.stringify({ locationId: 1 }),
                  },
                },
              ],
            },
          },
        ],
      })
      // Second call: AI provides final answer
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({
                decision: "approve",
                confidence: 0.88,
                reasoning: "Weather is VFR, safe to fly.",
                riskFactors: [],
                mitigations: ["VFR conditions confirmed"],
              }),
              tool_calls: null,
            },
          },
        ],
      });

    mockGetClient.mockReturnValue({
      chat: { completions: { create: mockCreate } },
    } as never);

    const result = await agent.evaluate(makeContext());

    expect(result.method).toBe("ai");
    expect(result.decision).toBe("approve");
    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0].tool).toBe("getWeather");
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  it("falls back to deterministic on OpenAI error", async () => {
    mockGetClient.mockReturnValue({
      chat: {
        completions: {
          create: vi
            .fn()
            .mockRejectedValue(new Error("API key invalid")),
        },
      },
    } as never);

    const result = await agent.evaluate(makeContext());

    expect(result.method).toBe("deterministic");
    expect(result.decision).toBeDefined();
    expect(result.confidence).toBeGreaterThan(0);
  });

  it("falls back to deterministic on malformed JSON response", async () => {
    mockGetClient.mockReturnValue({
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [
              {
                message: {
                  content: "This is not JSON at all",
                  tool_calls: null,
                },
              },
            ],
          }),
        },
      },
    } as never);

    const result = await agent.evaluate(makeContext());

    expect(result.method).toBe("deterministic");
  });

  it("falls back to deterministic when max iterations exceeded", async () => {
    // Always return tool calls, never a final answer
    const mockCreate = vi.fn().mockResolvedValue({
      choices: [
        {
          message: {
            content: null,
            tool_calls: [
              {
                id: "call-loop",
                type: "function",
                function: {
                  name: "getWeather",
                  arguments: JSON.stringify({ locationId: 1 }),
                },
              },
            ],
          },
        },
      ],
    });

    mockGetClient.mockReturnValue({
      chat: { completions: { create: mockCreate } },
    } as never);

    const result = await agent.evaluate(makeContext());

    expect(result.method).toBe("deterministic");
    // Should have been called exactly MAX_ITERATIONS times
    expect(mockCreate).toHaveBeenCalledTimes(5);
  });

  it("defaults missing fields in AI response", async () => {
    const aiResponse = JSON.stringify({
      decision: "defer",
      // missing confidence, reasoning, riskFactors, mitigations
    });

    mockGetClient.mockReturnValue({
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [
              {
                message: {
                  content: aiResponse,
                  tool_calls: null,
                },
              },
            ],
          }),
        },
      },
    } as never);

    const result = await agent.evaluate(makeContext());

    expect(result.method).toBe("ai");
    expect(result.decision).toBe("defer");
    expect(result.confidence).toBe(0.5);
    expect(result.reasoning).toBe("No reasoning provided");
    expect(result.riskFactors).toEqual([]);
    expect(result.mitigations).toEqual([]);
  });

  it("passes correct parameters to OpenAI", async () => {
    const mockCreate = vi.fn().mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              decision: "approve",
              confidence: 0.9,
              reasoning: "OK",
              riskFactors: [],
              mitigations: [],
            }),
            tool_calls: null,
          },
        },
      ],
    });

    mockGetClient.mockReturnValue({
      chat: { completions: { create: mockCreate } },
    } as never);

    await agent.evaluate(makeContext());

    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.model).toBe("gpt-4o");
    expect(callArgs.temperature).toBe(0.3);
    expect(callArgs.max_tokens).toBe(1000);
    expect(callArgs.tools).toBeDefined();
    expect(callArgs.tool_choice).toBe("auto");
    // messages array is passed by reference — it may have grown after the call
    expect(callArgs.messages.length).toBeGreaterThanOrEqual(2);
    // The first two messages should always be system + user
    expect(callArgs.messages[0].role).toBe("system");
    expect(callArgs.messages[1].role).toBe("user");
  });
});
