// ---------------------------------------------------------------------------
// send-approval-notification — fire-and-forget notification after approval
// ---------------------------------------------------------------------------

import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { CommunicationService } from "./communication-service";
import { FspEmailProvider } from "./email-provider";
import { SmsProvider } from "./sms-provider";
import { getTemplate, renderTemplate } from "./templates";
import { FeatureFlagService } from "@/lib/feature-flags/feature-flags";
import type { ProposalWithActions } from "@/lib/db/queries/proposals";

export interface ApprovalNotificationParams {
  db: PostgresJsDatabase;
  operatorId: number;
  proposal: ProposalWithActions;
  /** Name to address the student as in the notification */
  studentName?: string;
  /** Email of the student, if available */
  studentEmail?: string;
  /** Phone number of the student, if available */
  studentPhone?: string;
  /** Operator display name for the template */
  operatorName?: string;
  /** Whether execution succeeded — determines which template to use */
  executionSuccess: boolean;
  /** Resolved display names for instructor/aircraft/location */
  instructorName?: string;
  aircraftTail?: string;
  locationName?: string;
}

/**
 * Send approval/execution notification via configured channels.
 * This is a fire-and-forget helper — errors are caught and logged,
 * never thrown to the caller.
 */
export async function sendApprovalNotification(
  params: ApprovalNotificationParams
): Promise<void> {
  const {
    db,
    operatorId,
    proposal,
    studentName = "Student",
    studentEmail,
    studentPhone,
    operatorName = "Your Flight School",
    executionSuccess,
    instructorName: resolvedInstructor,
    aircraftTail: resolvedAircraft,
    locationName: resolvedLocation,
  } = params;

  try {
    const flagService = new FeatureFlagService(db);
    const flags = await flagService.getFlags(operatorId);

    const commsService = new CommunicationService(db);
    commsService.registerProvider(new FspEmailProvider());
    commsService.registerProvider(new SmsProvider());

    // Pick template based on whether execution succeeded
    const templateId = executionSuccess
      ? "reservation_created"
      : "proposal_approved";
    const template = getTemplate(templateId);
    if (!template) return;

    // Build template variables from proposal actions
    const firstAction = proposal.actions[0];
    const variables: Record<string, string> = {
      studentName,
      operatorName,
      workflowType: proposal.workflowType ?? "lesson",
      date: firstAction
        ? new Date(firstAction.startTime).toLocaleDateString()
        : "TBD",
      time: firstAction
        ? new Date(firstAction.startTime).toLocaleTimeString()
        : "TBD",
      location: resolvedLocation ?? (firstAction ? String(firstAction.locationId) : "TBD"),
      reservationId: firstAction?.fspReservationId ?? proposal.id,
      instructorName: resolvedInstructor ?? firstAction?.instructorId ?? "TBD",
      aircraftTail: resolvedAircraft ?? firstAction?.aircraftId ?? "TBD",
    };

    const rendered = renderTemplate(template, variables);

    // Send email if enabled and we have an address
    if (flags.enableEmailNotifications && studentEmail) {
      await commsService
        .send({
          operatorId,
          channel: "email",
          recipientId: proposal.affectedStudentIds?.[0] ?? "unknown",
          to: studentEmail,
          subject: rendered.subject,
          body: rendered.body,
          templateId,
          proposalId: proposal.id,
        })
        .catch((err) =>
          console.error("[sendApprovalNotification] email error:", err)
        );
    }

    // Send SMS if enabled and we have a phone number
    if (flags.enableSmsNotifications && studentPhone) {
      await commsService
        .send({
          operatorId,
          channel: "sms",
          recipientId: proposal.affectedStudentIds?.[0] ?? "unknown",
          to: studentPhone,
          subject: rendered.subject,
          body: rendered.body,
          templateId,
          proposalId: proposal.id,
        })
        .catch((err) =>
          console.error("[sendApprovalNotification] sms error:", err)
        );
    }
  } catch (err) {
    // Never let notification failures propagate
    console.error("[sendApprovalNotification] unexpected error:", err);
  }
}
