// ---------------------------------------------------------------------------
// FSP Email Provider — stub for sending via FSP API
// ---------------------------------------------------------------------------

import type {
  CommunicationProvider,
  SendMessageRequest,
  SendMessageResult,
} from "./types";

/**
 * Email provider that will integrate with the FSP API for sending emails.
 * Currently stubbed — returns success without actually sending.
 */
export class FspEmailProvider implements CommunicationProvider {
  readonly channel = "email" as const;

  async send(request: SendMessageRequest): Promise<SendMessageResult> {
    // TODO: integrate with FSP email API when credentials are available
    // For now, simulate a successful send
    const messageId = `email-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    console.log(
      `[FspEmailProvider] Stub send to=${request.to} subject="${request.subject ?? "(no subject)"}"`
    );

    return {
      success: true,
      messageId,
    };
  }
}
