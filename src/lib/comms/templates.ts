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
    body: "Hi {{studentName}},\n\nGreat news! Your {{workflowType}} has been approved and scheduled.\n\nDetails:\n- Date: {{date}}\n- Time: {{time}}\n- Location: {{location}}\n\nSee you there!\n\nBest,\n{{operatorName}}\n\nTo unsubscribe from these notifications: {{unsubscribeUrl}}",
  },
  reservation_created: {
    id: "reservation_created",
    subject: "Reservation confirmed",
    body: "Hi {{studentName}},\n\nYour reservation has been confirmed in the schedule.\n\nReservation ID: {{reservationId}}\n- Date: {{date}}\n- Time: {{time}}\n- Instructor: {{instructorName}}\n- Aircraft: {{aircraftTail}}\n\nBest,\n{{operatorName}}\n\nTo unsubscribe from these notifications: {{unsubscribeUrl}}",
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

/** Custom template override shape stored in operator_settings. */
export type OperatorTemplateOverrides = Record<
  string,
  { subject: string; body: string }
> | null;

/**
 * Resolve a template for a specific operator.
 * If the operator has a custom override for this template, use it;
 * otherwise fall back to the default hardcoded template.
 */
export function getTemplateForOperator(
  templateName: string,
  operatorTemplates: OperatorTemplateOverrides
): MessageTemplate | undefined {
  if (operatorTemplates && templateName in operatorTemplates) {
    const custom = operatorTemplates[templateName];
    return {
      id: templateName,
      subject: custom.subject,
      body: custom.body,
    };
  }
  return templates[templateName];
}

/**
 * Get the default (hardcoded) templates registry.
 * Useful for the template editor to show all available templates.
 */
export function getDefaultTemplates(): Record<string, MessageTemplate> {
  return { ...templates };
}

/**
 * Extract variable names from a template body/subject string.
 * Returns unique variable names found in {{variable}} placeholders.
 */
export function extractTemplateVariables(template: MessageTemplate): string[] {
  const vars = new Set<string>();
  const regex = /\{\{(\w+)\}\}/g;
  let match: RegExpExecArray | null;

  const texts = [template.body];
  if (template.subject) texts.push(template.subject);

  for (const text of texts) {
    while ((match = regex.exec(text)) !== null) {
      vars.add(match[1]);
    }
  }

  return Array.from(vars);
}
