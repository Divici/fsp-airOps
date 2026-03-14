// ---------------------------------------------------------------------------
// Communication Templates — message templates with variable interpolation
// ---------------------------------------------------------------------------

export interface MessageTemplate {
  id: string;
  subject?: string;
  body: string;
}

const templates: Record<string, MessageTemplate> = {
  proposal_ready: {
    id: "proposal_ready",
    subject: "New scheduling proposal ready for review",
    body: "Hi {{dispatcherName}},\n\nA new {{workflowType}} proposal has been generated for {{studentName}}.\n\nSummary: {{summary}}\n\nPlease review it in the AirOps console.\n\nBest,\nFSP AirOps",
  },
  proposal_approved: {
    id: "proposal_approved",
    subject: "Your lesson has been scheduled",
    body: "Hi {{studentName}},\n\nGreat news! Your {{workflowType}} has been approved and scheduled.\n\nDetails:\n- Date: {{date}}\n- Time: {{time}}\n- Location: {{location}}\n\nSee you there!\n\nBest,\n{{operatorName}}",
  },
  reservation_created: {
    id: "reservation_created",
    subject: "Reservation confirmed",
    body: "Hi {{studentName}},\n\nYour reservation has been confirmed in the schedule.\n\nReservation ID: {{reservationId}}\n- Date: {{date}}\n- Time: {{time}}\n- Instructor: {{instructorName}}\n- Aircraft: {{aircraftTail}}\n\nBest,\n{{operatorName}}",
  },
  discovery_flight_confirmation: {
    id: "discovery_flight_confirmation",
    subject: "Your discovery flight is confirmed!",
    body: "Hi {{prospectName}},\n\nWe are excited to confirm your discovery flight!\n\n- Date: {{date}}\n- Time: {{time}}\n- Location: {{location}}\n- Instructor: {{instructorName}}\n\nPlease arrive 15 minutes early. Bring a valid photo ID.\n\nIf you need to reschedule, please contact us at {{contactPhone}}.\n\nSee you soon!\n{{operatorName}}",
  },
};

/**
 * Get a template by ID.
 */
export function getTemplate(templateId: string): MessageTemplate | undefined {
  return templates[templateId];
}

/**
 * Render a template by replacing {{variable}} placeholders with provided values.
 * Unknown variables are left as-is.
 */
export function renderTemplate(
  template: MessageTemplate,
  variables: Record<string, string>
): { subject?: string; body: string } {
  const interpolate = (text: string): string =>
    text.replace(/\{\{(\w+)\}\}/g, (match, key: string) =>
      key in variables ? variables[key] : match
    );

  return {
    subject: template.subject ? interpolate(template.subject) : undefined,
    body: interpolate(template.body),
  };
}

/**
 * List all available template IDs.
 */
export function listTemplateIds(): string[] {
  return Object.keys(templates);
}
