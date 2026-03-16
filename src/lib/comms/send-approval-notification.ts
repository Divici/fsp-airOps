// ---------------------------------------------------------------------------
// send-approval-notification — fire-and-forget notification after approval
// ---------------------------------------------------------------------------

import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { CommunicationService } from "./communication-service";
import { FspEmailProvider } from "./email-provider";
import { SmsProvider } from "./sms-provider";
import { getTemplate, renderTemplate } from "./templates";
import { wrapInHtmlTemplate } from "./html-template";
import { FeatureFlagService } from "@/lib/feature-flags/feature-flags";
import type { ProposalWithActions } from "@/lib/db/queries/proposals";
import { isOptedOut } from "@/lib/db/queries/communication-opt-outs";
import { generateUnsubscribeToken } from "./unsubscribe";

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
  /** Operator brand color (hex) for HTML emails. Defaults to #2563eb. */
  brandColor?: string;
  /** URL to operator logo image for HTML emails. */
  logoUrl?: string;
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
    brandColor = "#2563eb",
    logoUrl,
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

    const studentRecipientId = proposal.affectedStudentIds?.[0] ?? "unknown";

    // Generate unsubscribe URLs for each channel
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    // Send email if enabled and we have an address
    if (flags.enableEmailNotifications && studentEmail) {
      // Check per-student opt-out
      if (await isOptedOut(db, operatorId, studentRecipientId, "email")) {
        console.log(
          `[sendApprovalNotification] skipping email — student ${studentRecipientId} opted out`
        );
      } else {
        const emailToken = await generateUnsubscribeToken(
          studentRecipientId,
          operatorId,
          "email"
        );
        const emailVars = {
          ...variables,
          unsubscribeUrl: `${appUrl}/unsubscribe/${emailToken}`,
        };
        const rendered = renderTemplate(template, emailVars);

        // Build HTML version for email with operator branding
        const htmlEmail = wrapInHtmlTemplate({
          body: rendered.body,
          subject: rendered.subject,
          brandColor,
          logoUrl: logoUrl ?? undefined,
          operatorName,
        });

        await commsService
          .send({
            operatorId,
            channel: "email",
            recipientId: studentRecipientId,
            to: studentEmail,
            subject: rendered.subject,
            body: rendered.body,
            html: htmlEmail,
            templateId,
            proposalId: proposal.id,
          })
          .catch((err) =>
            console.error("[sendApprovalNotification] email error:", err)
          );
      }
    }

    // Send SMS if enabled and we have a phone number
    if (flags.enableSmsNotifications && studentPhone) {
      // Check per-student opt-out
      if (await isOptedOut(db, operatorId, studentRecipientId, "sms")) {
        console.log(
          `[sendApprovalNotification] skipping sms — student ${studentRecipientId} opted out`
        );
      } else {
        const smsToken = await generateUnsubscribeToken(
          studentRecipientId,
          operatorId,
          "sms"
        );
        const smsVars = {
          ...variables,
          unsubscribeUrl: `${appUrl}/unsubscribe/${smsToken}`,
        };
        const rendered = renderTemplate(template, smsVars);

        await commsService
          .send({
            operatorId,
            channel: "sms",
            recipientId: studentRecipientId,
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
    }
  } catch (err) {
    // Never let notification failures propagate
    console.error("[sendApprovalNotification] unexpected error:", err);
  }
}
