// ---------------------------------------------------------------------------
// Email Provider — SendGrid integration with stub fallback
// ---------------------------------------------------------------------------

import type {
  CommunicationProvider,
  SendMessageRequest,
  SendMessageResult,
} from "./types";

/**
 * Email provider that sends via SendGrid when credentials are configured.
 * Falls back to console logging when env vars are missing (dev/test).
 */
export class FspEmailProvider implements CommunicationProvider {
  readonly channel = "email" as const;

  private apiKey: string | undefined;
  private fromEmail: string | undefined;

  constructor() {
    this.apiKey = process.env.SENDGRID_API_KEY;
    this.fromEmail = process.env.SENDGRID_FROM_EMAIL;
  }

  private get isConfigured(): boolean {
    return Boolean(this.apiKey && this.fromEmail);
  }

  async send(request: SendMessageRequest): Promise<SendMessageResult> {
    if (!this.isConfigured) {
      // Fallback: log and return a stub success
      const messageId = `email-stub-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      console.log(
        `[FspEmailProvider] Stub send (no credentials) to=${request.to} subject="${request.subject ?? "(no subject)"}"`
      );
      return { success: true, messageId };
    }

    try {
      // Dynamic import to avoid loading SendGrid in environments without it
      const sgMail = await import("@sendgrid/mail");
      const client = sgMail.default ?? sgMail;
      client.setApiKey(this.apiKey!);

      const [response] = await client.send({
        to: request.to,
        from: this.fromEmail!,
        subject: request.subject ?? "(No subject)",
        text: request.body,
      });

      const messageId =
        response?.headers?.["x-message-id"] ??
        `email-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      return { success: true, messageId: String(messageId) };
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : "Unknown SendGrid error";
      console.error(`[FspEmailProvider] SendGrid error: ${errorMsg}`);
      return { success: false, error: errorMsg };
    }
  }
}
