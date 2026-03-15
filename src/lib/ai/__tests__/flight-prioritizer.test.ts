import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  prioritizeFlights,
  prioritizeFallback,
  type FlightForPrioritization,
} from "../flight-prioritizer";
import { buildFlightPrioritizationPrompt } from "../prompts/flight-prioritization";

// Mock the OpenAI client module
vi.mock("../client", () => ({
  getOpenAIClient: vi.fn(),
}));

import { getOpenAIClient } from "../client";

const mockGetClient = vi.mocked(getOpenAIClient);

function makeFlight(
  overrides: Partial<FlightForPrioritization> = {},
): FlightForPrioritization {
  return {
    reservationId: "res-1",
    studentId: "student-1",
    studentName: "Alice Johnson",
    instructorName: "Bob Smith",
    startTime: "2026-03-15T10:00:00Z",
    daysSinceLastFlight: 3,
    trainingStage: "Stage 2",
    checkrideDateDays: null,
    totalFlightHours: 25,
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

describe("prioritizeFlights", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty array for empty input", async () => {
    const result = await prioritizeFlights([]);
    expect(result).toEqual([]);
  });

  it("returns flights sorted by AI urgency score", async () => {
    const flights = [
      makeFlight({ reservationId: "res-1", studentName: "Alice" }),
      makeFlight({ reservationId: "res-2", studentName: "Bob" }),
    ];

    const aiResponse = JSON.stringify({
      flights: [
        {
          reservationId: "res-2",
          urgencyScore: 85,
          reasoning: "Bob has checkride soon.",
        },
        {
          reservationId: "res-1",
          urgencyScore: 45,
          reasoning: "Alice has routine lesson.",
        },
      ],
    });

    mockGetClient.mockReturnValue(mockOpenAIResponse(aiResponse) as never);

    const result = await prioritizeFlights(flights);

    expect(result).toHaveLength(2);
    expect(result[0].reservationId).toBe("res-2");
    expect(result[0].urgencyScore).toBe(85);
    expect(result[0].reasoning).toBe("Bob has checkride soon.");
    expect(result[1].reservationId).toBe("res-1");
    expect(result[1].urgencyScore).toBe(45);
  });

  it("clamps AI scores to 0-100 range", async () => {
    const flights = [makeFlight({ reservationId: "res-1" })];

    const aiResponse = JSON.stringify({
      flights: [
        {
          reservationId: "res-1",
          urgencyScore: 150,
          reasoning: "Very urgent.",
        },
      ],
    });

    mockGetClient.mockReturnValue(mockOpenAIResponse(aiResponse) as never);

    const result = await prioritizeFlights(flights);
    expect(result[0].urgencyScore).toBe(100);
  });

  it("falls back to deterministic scoring on OpenAI error", async () => {
    mockGetClient.mockReturnValue({
      chat: {
        completions: {
          create: vi
            .fn()
            .mockRejectedValue(new Error("API rate limit exceeded")),
        },
      },
    } as never);

    const flights = [
      makeFlight({
        reservationId: "res-1",
        daysSinceLastFlight: 14,
        studentName: "Inactive",
      }),
      makeFlight({
        reservationId: "res-2",
        daysSinceLastFlight: 3,
        studentName: "Recent",
      }),
    ];

    const result = await prioritizeFlights(flights);

    expect(result).toHaveLength(2);
    // Most inactive should come first
    expect(result[0].reservationId).toBe("res-1");
    expect(result[0].urgencyScore).toBe(100);
    expect(result[1].reservationId).toBe("res-2");
    expect(result[1].urgencyScore).toBe(10);
  });

  it("falls back on malformed JSON response", async () => {
    mockGetClient.mockReturnValue(
      mockOpenAIResponse("not valid json {{{") as never,
    );

    const flights = [makeFlight({ daysSinceLastFlight: 5 })];
    const result = await prioritizeFlights(flights);

    // Should produce valid fallback output
    expect(result).toHaveLength(1);
    expect(result[0].urgencyScore).toBeGreaterThan(0);
    expect(result[0].reasoning).toBeTruthy();
  });

  it("falls back when AI response has no flights array", async () => {
    const aiResponse = JSON.stringify({ result: "oops" });
    mockGetClient.mockReturnValue(mockOpenAIResponse(aiResponse) as never);

    const flights = [makeFlight({ daysSinceLastFlight: 7 })];
    const result = await prioritizeFlights(flights);

    expect(result).toHaveLength(1);
    expect(result[0].urgencyScore).toBeGreaterThan(0);
  });

  it("calls OpenAI with correct model and parameters", async () => {
    const mockCreate = vi.fn().mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              flights: [
                {
                  reservationId: "res-1",
                  urgencyScore: 50,
                  reasoning: "OK.",
                },
              ],
            }),
          },
        },
      ],
    });

    mockGetClient.mockReturnValue({
      chat: { completions: { create: mockCreate } },
    } as never);

    await prioritizeFlights([makeFlight()]);

    expect(mockCreate).toHaveBeenCalledOnce();
    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.model).toBe("gpt-4o");
    expect(callArgs.temperature).toBe(0.2);
    expect(callArgs.response_format).toEqual({ type: "json_object" });
  });

  it("respects custom model option", async () => {
    const mockCreate = vi.fn().mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              flights: [
                {
                  reservationId: "res-1",
                  urgencyScore: 50,
                  reasoning: "OK.",
                },
              ],
            }),
          },
        },
      ],
    });

    mockGetClient.mockReturnValue({
      chat: { completions: { create: mockCreate } },
    } as never);

    await prioritizeFlights([makeFlight()], { model: "gpt-4o-mini" });

    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.model).toBe("gpt-4o-mini");
  });
});

describe("prioritizeFallback", () => {
  it("returns empty array for empty input", () => {
    expect(prioritizeFallback([])).toEqual([]);
  });

  it("sorts by daysSinceLastFlight descending", () => {
    const flights = [
      makeFlight({
        reservationId: "res-recent",
        daysSinceLastFlight: 2,
      }),
      makeFlight({
        reservationId: "res-stale",
        daysSinceLastFlight: 14,
      }),
      makeFlight({
        reservationId: "res-medium",
        daysSinceLastFlight: 7,
      }),
    ];

    const result = prioritizeFallback(flights);

    expect(result[0].reservationId).toBe("res-stale");
    expect(result[1].reservationId).toBe("res-medium");
    expect(result[2].reservationId).toBe("res-recent");
  });

  it("bumps students with checkride within 7 days to top", () => {
    const flights = [
      makeFlight({
        reservationId: "res-inactive",
        daysSinceLastFlight: 20,
        checkrideDateDays: null,
      }),
      makeFlight({
        reservationId: "res-checkride",
        daysSinceLastFlight: 1,
        checkrideDateDays: 3,
      }),
    ];

    const result = prioritizeFallback(flights);

    expect(result[0].reservationId).toBe("res-checkride");
    expect(result[0].urgencyScore).toBe(100);
    expect(result[0].reasoning).toContain("Checkride in 3 day(s)");
    expect(result[1].reservationId).toBe("res-inactive");
  });

  it("sorts checkride-imminent students by closest checkride first", () => {
    const flights = [
      makeFlight({
        reservationId: "res-ck7",
        checkrideDateDays: 7,
        daysSinceLastFlight: 1,
      }),
      makeFlight({
        reservationId: "res-ck2",
        checkrideDateDays: 2,
        daysSinceLastFlight: 1,
      }),
      makeFlight({
        reservationId: "res-ck5",
        checkrideDateDays: 5,
        daysSinceLastFlight: 1,
      }),
    ];

    const result = prioritizeFallback(flights);

    expect(result[0].reservationId).toBe("res-ck2");
    expect(result[1].reservationId).toBe("res-ck5");
    expect(result[2].reservationId).toBe("res-ck7");
  });

  it("assigns linear scores from 100 down to at least 10", () => {
    const flights = Array.from({ length: 5 }, (_, i) =>
      makeFlight({
        reservationId: `res-${i}`,
        daysSinceLastFlight: 10 - i,
      }),
    );

    const result = prioritizeFallback(flights);

    expect(result[0].urgencyScore).toBe(100);
    expect(result[result.length - 1].urgencyScore).toBeGreaterThanOrEqual(10);

    // Scores should be descending
    for (let i = 1; i < result.length; i++) {
      expect(result[i].urgencyScore).toBeLessThanOrEqual(
        result[i - 1].urgencyScore,
      );
    }
  });

  it("handles null daysSinceLastFlight as 0", () => {
    const flights = [
      makeFlight({
        reservationId: "res-null",
        daysSinceLastFlight: null,
      }),
      makeFlight({
        reservationId: "res-known",
        daysSinceLastFlight: 5,
      }),
    ];

    const result = prioritizeFallback(flights);

    // Known days should come first (more inactive)
    expect(result[0].reservationId).toBe("res-known");
    expect(result[1].reservationId).toBe("res-null");
  });

  it("provides descriptive reasoning for each category", () => {
    const flights = [
      makeFlight({
        reservationId: "res-ck",
        checkrideDateDays: 3,
        daysSinceLastFlight: 2,
      }),
      makeFlight({
        reservationId: "res-gap",
        checkrideDateDays: null,
        daysSinceLastFlight: 10,
      }),
      makeFlight({
        reservationId: "res-routine",
        checkrideDateDays: null,
        daysSinceLastFlight: null,
      }),
    ];

    const result = prioritizeFallback(flights);

    const checkrideFlight = result.find((f) => f.reservationId === "res-ck")!;
    const gapFlight = result.find((f) => f.reservationId === "res-gap")!;
    const routineFlight = result.find(
      (f) => f.reservationId === "res-routine",
    )!;

    expect(checkrideFlight.reasoning).toContain("Checkride");
    expect(gapFlight.reasoning).toContain("days since last flight");
    expect(routineFlight.reasoning).toContain("Routine");
  });

  it("handles single flight correctly", () => {
    const result = prioritizeFallback([makeFlight()]);

    expect(result).toHaveLength(1);
    expect(result[0].urgencyScore).toBe(100);
  });
});

describe("buildFlightPrioritizationPrompt", () => {
  it("includes all flight context in prompt", () => {
    const flights = [
      {
        reservationId: "res-123",
        studentName: "Dave Miller",
        startTime: "2026-03-15T10:00:00Z",
        daysSinceLastFlight: 7,
        trainingStage: "Stage 3 - Pre-Solo",
        checkrideDateDays: 14,
        totalFlightHours: 35,
      },
    ];

    const prompt = buildFlightPrioritizationPrompt(flights);

    expect(prompt).toContain("res-123");
    expect(prompt).toContain("Dave Miller");
    expect(prompt).toContain("2026-03-15T10:00:00Z");
    expect(prompt).toContain("7");
    expect(prompt).toContain("Stage 3 - Pre-Solo");
    expect(prompt).toContain("14");
    expect(prompt).toContain("35");
  });

  it("handles null/undefined optional fields", () => {
    const flights = [
      {
        reservationId: "res-456",
        studentName: "Jane Doe",
        startTime: "2026-03-15T14:00:00Z",
        daysSinceLastFlight: null,
      },
    ];

    const prompt = buildFlightPrioritizationPrompt(flights);

    expect(prompt).toContain("res-456");
    expect(prompt).toContain("Jane Doe");
    expect(prompt).toContain("unknown");
    // Should NOT contain training stage or checkride lines
    expect(prompt).not.toContain("Training stage");
    expect(prompt).not.toContain("Days until checkride");
  });

  it("includes multiple flights", () => {
    const flights = [
      {
        reservationId: "res-1",
        studentName: "Alice",
        startTime: "2026-03-15T10:00:00Z",
        daysSinceLastFlight: 3,
      },
      {
        reservationId: "res-2",
        studentName: "Bob",
        startTime: "2026-03-15T11:00:00Z",
        daysSinceLastFlight: 10,
      },
    ];

    const prompt = buildFlightPrioritizationPrompt(flights);

    expect(prompt).toContain("Flight 1 (res-1)");
    expect(prompt).toContain("Flight 2 (res-2)");
    expect(prompt).toContain("2 flight(s)");
  });
});
