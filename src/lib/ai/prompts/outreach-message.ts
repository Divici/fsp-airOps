// ---------------------------------------------------------------------------
// Prompt Template — AI Outreach Message Generation
// ---------------------------------------------------------------------------

import type { OutreachContext } from "../outreach-message-generator";

export const OUTREACH_MESSAGE_SYSTEM_PROMPT = `You are writing a friendly, encouraging email to a flight school student who hasn't flown recently. Be warm and motivational, not pushy. Mention their specific training context.

Guidelines:
- Keep the subject line short and engaging (under 60 characters)
- Keep the body concise — 3-5 sentences
- Mention how long it has been since they last flew
- Reference their next lesson type to remind them of progress
- Include the proposed date/time and instructor name
- End with the operator name as the sign-off
- Do not use excessive exclamation marks or sales language

Respond with a JSON object:
{
  "subject": "string",
  "body": "string"
}`;

export function buildOutreachPrompt(context: OutreachContext): string {
  return `## Outreach Context
- Student name: ${context.studentName}
- Days since last flight: ${context.daysSinceLastFlight}
- Next lesson type: ${context.nextLessonType}
- Proposed date: ${context.proposedDate}
- Proposed time: ${context.proposedTime}
- Instructor: ${context.instructorName}
- Flight school: ${context.operatorName}

Write a personalized outreach email for this student. Return JSON with "subject" and "body".`;
}
