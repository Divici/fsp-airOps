import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { OutreachContext } from "../outreach-message-generator";

// Mock the OpenAI client module
vi.mock("../client", () => ({
  getOpenAIClient: vi.fn(),
}));

import { getOpenAIClient } from "../client";
import {
  generateOutreachMessage,
  generateFallbackMessage,
} from "../outreach-message-generator";
import { buildOutreachPrompt } from "../prompts/outreach-message";

const mockGetClient = vi.mocked(getOpenAIClient);

function makeContext(overrides: Partial<OutreachContext> = {}): OutreachContext {
  return {
    studentName: "John Smith",
    daysSinceLastFlight: 21,
    nextLessonType: "Solo Cross-Country",
    proposedDate: "2026-03-20",
    proposedTime: "10:00 AM",
    instructorName: "Jane Instructor",
    operatorName: "Blue Skies Flight School",
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

describe("generateOutreachMessage", () => {
  const originalEnv = process.env.OPENAI_API_KEY;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OPENAI_API_KEY = "test-key";
  });

  afterEach(() => {
    process.env.OPENAI_API_KEY = originalEnv;
  });

  it("returns fallback message when OpenAI API key is not configured", async () => {
    delete process.env.OPENAI_API_KEY;

    const context = makeContext();
    const result = await generateOutreachMessage(context);

    expect(result.subject).toContain("John Smith");
    expect(result.body).toContain("John Smith");
    expect(result.body).toContain("Solo Cross-Country");
    expect(result.body).toContain("2026-03-20");
    expect(result.body).toContain("10:00 AM");
    expect(result.body).toContain("Jane Instructor");
    expect(result.body).toContain("Blue Skies Flight School");
    expect(mockGetClient).not.toHaveBeenCalled();
  });

  it("returns fallback message when OpenAI call fails", async () => {
    mockGetClient.mockReturnValue({
      chat: {
        completions: {
          create: vi.fn().mockRejectedValue(new Error("API error")),
        },
      },
    } as never);

    const context = makeContext();
    const result = await generateOutreachMessage(context);

    expect(result.subject).toBeTruthy();
    expect(result.body).toContain("John Smith");
    expect(result.body).toContain("Blue Skies Flight School");
  });

  it("returns AI-generated message on success", async () => {
    const aiResponse = JSON.stringify({
      subject: "Ready for your next adventure, John?",
      body: "Hi John, it has been a few weeks. Time to fly again!",
    });

    mockGetClient.mockReturnValue(mockOpenAIResponse(aiResponse) as never);

    const result = await generateOutreachMessage(makeContext());

    expect(result.subject).toBe("Ready for your next adventure, John?");
    expect(result.body).toContain("Time to fly again");
  });

  it("falls back for empty AI subject/body", async () => {
    const aiResponse = JSON.stringify({
      subject: "",
      body: "",
    });

    mockGetClient.mockReturnValue(mockOpenAIResponse(aiResponse) as never);

    const context = makeContext();
    const result = await generateOutreachMessage(context);

    // Should use fallback for empty fields
    expect(result.subject).toContain("John Smith");
    expect(result.body).toContain("John Smith");
  });

  it("calls OpenAI with correct parameters", async () => {
    const mockCreate = vi.fn().mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              subject: "Test",
              body: "Test body",
            }),
          },
        },
      ],
    });

    mockGetClient.mockReturnValue({
      chat: { completions: { create: mockCreate } },
    } as never);

    await generateOutreachMessage(makeContext());

    expect(mockCreate).toHaveBeenCalledOnce();
    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.model).toBe("gpt-4o");
    expect(callArgs.temperature).toBe(0.7);
    expect(callArgs.response_format).toEqual({ type: "json_object" });
  });
});

describe("generateFallbackMessage", () => {
  it("includes all context variables in the template", () => {
    const context = makeContext();
    const result = generateFallbackMessage(context);

    expect(result.subject).toContain("John Smith");
    expect(result.body).toContain("John Smith");
    expect(result.body).toContain("Solo Cross-Country");
    expect(result.body).toContain("2026-03-20");
    expect(result.body).toContain("10:00 AM");
    expect(result.body).toContain("Jane Instructor");
    expect(result.body).toContain("Blue Skies Flight School");
  });

  it("uses weeks phrasing for 14+ days", () => {
    const context = makeContext({ daysSinceLastFlight: 21 });
    const result = generateFallbackMessage(context);

    expect(result.body).toContain("3 weeks");
  });

  it("uses days phrasing for fewer than 14 days", () => {
    const context = makeContext({ daysSinceLastFlight: 10 });
    const result = generateFallbackMessage(context);

    expect(result.body).toContain("10 days");
  });
});

describe("buildOutreachPrompt", () => {
  it("includes all context fields", () => {
    const context = makeContext();
    const prompt = buildOutreachPrompt(context);

    expect(prompt).toContain("John Smith");
    expect(prompt).toContain("21");
    expect(prompt).toContain("Solo Cross-Country");
    expect(prompt).toContain("2026-03-20");
    expect(prompt).toContain("10:00 AM");
    expect(prompt).toContain("Jane Instructor");
    expect(prompt).toContain("Blue Skies Flight School");
  });
});
