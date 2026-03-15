import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { SlotOption } from "@/lib/types/workflow";
import type { StudentHistory } from "../slot-ranker";

// Mock the OpenAI client module
vi.mock("../client", () => ({
  getOpenAIClient: vi.fn(),
}));

import { getOpenAIClient } from "../client";
import { rankSlotsWithAI } from "../slot-ranker";
import { buildSlotRankingPrompt } from "../prompts/slot-ranking";

const mockGetClient = vi.mocked(getOpenAIClient);

function makeSlot(overrides: Partial<SlotOption> = {}): SlotOption {
  return {
    startTime: new Date("2026-03-16T10:00:00Z"),
    endTime: new Date("2026-03-16T12:00:00Z"),
    instructorId: "inst-1",
    aircraftId: "ac-1",
    locationId: 1,
    score: 50,
    ...overrides,
  };
}

function makeHistory(overrides: Partial<StudentHistory> = {}): StudentHistory {
  return {
    studentId: "student-1",
    studentName: "Jane Doe",
    recentBookings: [
      { dayOfWeek: "Monday", timeOfDay: "morning", instructorId: "inst-1" },
      { dayOfWeek: "Wednesday", timeOfDay: "afternoon", instructorId: "inst-1" },
    ],
    preferredInstructorId: "inst-1",
    daysSinceLastFlight: 14,
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

describe("rankSlotsWithAI", () => {
  const originalEnv = process.env.OPENAI_API_KEY;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OPENAI_API_KEY = "test-key";
  });

  afterEach(() => {
    process.env.OPENAI_API_KEY = originalEnv;
  });

  it("returns original order when OpenAI API key is not configured", async () => {
    delete process.env.OPENAI_API_KEY;

    const slots = [
      makeSlot({ instructorId: "inst-1", score: 50 }),
      makeSlot({ instructorId: "inst-2", score: 80 }),
      makeSlot({ instructorId: "inst-3", score: 30 }),
    ];

    const result = await rankSlotsWithAI(slots, makeHistory());

    expect(result).toEqual(slots);
    expect(mockGetClient).not.toHaveBeenCalled();
  });

  it("returns original order when OpenAI call fails", async () => {
    mockGetClient.mockReturnValue({
      chat: {
        completions: {
          create: vi.fn().mockRejectedValue(new Error("API timeout")),
        },
      },
    } as never);

    const slots = [
      makeSlot({ score: 50 }),
      makeSlot({ score: 80 }),
    ];

    const result = await rankSlotsWithAI(slots, makeHistory());

    expect(result).toEqual(slots);
  });

  it("reorders slots based on AI ranking", async () => {
    const aiResponse = JSON.stringify({
      rankedIndices: [2, 0, 1],
      reasons: [
        "Preferred instructor at preferred time",
        "Same instructor, different time",
        "Different instructor",
      ],
    });

    mockGetClient.mockReturnValue(mockOpenAIResponse(aiResponse) as never);

    const slots = [
      makeSlot({ instructorId: "inst-1", score: 50 }),
      makeSlot({ instructorId: "inst-2", score: 80 }),
      makeSlot({ instructorId: "inst-1", score: 30 }),
    ];

    const result = await rankSlotsWithAI(slots, makeHistory());

    // AI ranked index 2 first, then 0, then 1
    expect(result[0].instructorId).toBe("inst-1");
    expect(result[0].score).toBe(30);
    expect(result[1].instructorId).toBe("inst-1");
    expect(result[1].score).toBe(50);
    expect(result[2].instructorId).toBe("inst-2");
  });

  it("returns original order for single slot", async () => {
    const slots = [makeSlot()];

    const result = await rankSlotsWithAI(slots, makeHistory());

    expect(result).toEqual(slots);
    // Should not call OpenAI for single slot
    expect(mockGetClient).not.toHaveBeenCalled();
  });

  it("returns original order when AI returns invalid indices", async () => {
    const aiResponse = JSON.stringify({
      rankedIndices: [5, 10, -1],
      reasons: ["out of bounds"],
    });

    mockGetClient.mockReturnValue(mockOpenAIResponse(aiResponse) as never);

    const slots = [makeSlot({ score: 50 }), makeSlot({ score: 80 })];

    const result = await rankSlotsWithAI(slots, makeHistory());

    expect(result).toEqual(slots);
  });

  it("returns original order when AI returns duplicate indices", async () => {
    const aiResponse = JSON.stringify({
      rankedIndices: [0, 0, 1],
      reasons: ["dup"],
    });

    mockGetClient.mockReturnValue(mockOpenAIResponse(aiResponse) as never);

    const slots = [makeSlot({ score: 50 }), makeSlot({ score: 80 })];

    const result = await rankSlotsWithAI(slots, makeHistory());

    expect(result).toEqual(slots);
  });

  it("calls OpenAI with correct model and parameters", async () => {
    const mockCreate = vi.fn().mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              rankedIndices: [0, 1],
              reasons: ["a", "b"],
            }),
          },
        },
      ],
    });

    mockGetClient.mockReturnValue({
      chat: { completions: { create: mockCreate } },
    } as never);

    const slots = [makeSlot(), makeSlot({ score: 80 })];
    await rankSlotsWithAI(slots, makeHistory());

    expect(mockCreate).toHaveBeenCalledOnce();
    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.model).toBe("gpt-4o");
    expect(callArgs.temperature).toBe(0.2);
    expect(callArgs.response_format).toEqual({ type: "json_object" });
  });

  it("uses custom model when specified", async () => {
    const mockCreate = vi.fn().mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              rankedIndices: [0, 1],
              reasons: ["a", "b"],
            }),
          },
        },
      ],
    });

    mockGetClient.mockReturnValue({
      chat: { completions: { create: mockCreate } },
    } as never);

    const slots = [makeSlot(), makeSlot({ score: 80 })];
    await rankSlotsWithAI(slots, makeHistory(), { model: "gpt-4o-mini" });

    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.model).toBe("gpt-4o-mini");
  });
});

describe("buildSlotRankingPrompt", () => {
  it("includes student history in the prompt", () => {
    const slots = [
      makeSlot({ instructorId: "inst-1" }),
      makeSlot({ instructorId: "inst-2" }),
    ];
    const history = makeHistory();

    const prompt = buildSlotRankingPrompt(slots, history);

    expect(prompt).toContain("Jane Doe");
    expect(prompt).toContain("14"); // daysSinceLastFlight
    expect(prompt).toContain("inst-1"); // preferred instructor and slot
    expect(prompt).toContain("Monday");
    expect(prompt).toContain("morning");
    expect(prompt).toContain("Slot 0");
    expect(prompt).toContain("Slot 1");
  });

  it("handles empty recent bookings", () => {
    const slots = [makeSlot()];
    const history = makeHistory({ recentBookings: [] });

    const prompt = buildSlotRankingPrompt(slots, history);

    expect(prompt).toContain("No recent bookings");
  });

  it("includes preferred instructor when present", () => {
    const slots = [makeSlot()];
    const history = makeHistory({ preferredInstructorId: "inst-special" });

    const prompt = buildSlotRankingPrompt(slots, history);

    expect(prompt).toContain("inst-special");
  });
});
