// ---------------------------------------------------------------------------
// AI Outreach Message Generator — Creates personalized outreach emails
// Falls back to template-based messages if AI is unavailable.
// ---------------------------------------------------------------------------

import { getOpenAIClient } from "./client";
import {
  OUTREACH_MESSAGE_SYSTEM_PROMPT,
  buildOutreachPrompt,
} from "./prompts/outreach-message";

export interface OutreachContext {
  studentName: string;
  daysSinceLastFlight: number;
  nextLessonType: string;
  proposedDate: string;
  proposedTime: string;
  instructorName: string;
  operatorName: string;
}

export interface OutreachMessage {
  subject: string;
  body: string;
}

/**
 * Generate a personalized outreach email using AI.
 *
 * Falls back to a deterministic template if OpenAI is unavailable or fails.
 */
export async function generateOutreachMessage(
  context: OutreachContext,
): Promise<OutreachMessage> {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return generateFallbackMessage(context);
    }

    const client = getOpenAIClient();
    const prompt = buildOutreachPrompt(context);

    const response = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: OUTREACH_MESSAGE_SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_tokens: 400,
    });

    const raw = response.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw) as Record<string, unknown>;

    const subject =
      typeof parsed.subject === "string" && parsed.subject.length > 0
        ? parsed.subject
        : generateFallbackMessage(context).subject;

    const body =
      typeof parsed.body === "string" && parsed.body.length > 0
        ? parsed.body
        : generateFallbackMessage(context).body;

    return { subject, body };
  } catch {
    return generateFallbackMessage(context);
  }
}

/**
 * Template-based fallback message when AI is unavailable.
 */
export function generateFallbackMessage(
  context: OutreachContext,
): OutreachMessage {
  const weeks = Math.floor(context.daysSinceLastFlight / 7);
  const timePhrase =
    weeks >= 2
      ? `${weeks} weeks`
      : `${context.daysSinceLastFlight} days`;

  return {
    subject: `Time to get back in the air, ${context.studentName}!`,
    body: `Hi ${context.studentName},

It has been ${timePhrase} since your last flight, and we would love to see you back at the airport! Your next step is ${context.nextLessonType}, and we have a slot available for you.

Proposed schedule:
- Date: ${context.proposedDate}
- Time: ${context.proposedTime}
- Instructor: ${context.instructorName}

Let us know if this works for you, or if you would prefer a different time.

Best,
${context.operatorName}`,
  };
}
