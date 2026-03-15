// ---------------------------------------------------------------------------
// SMS Provider — Twilio integration with stub fallback
// ---------------------------------------------------------------------------

import type {
  CommunicationProvider,
  SendMessageRequest,
  SendMessageResult,
} from "./types";

/**
 * SMS provider that sends via Twilio when credentials are configured.
 * Falls back to console logging when env vars are missing (dev/test).
 */
export class SmsProvider implements CommunicationProvider {
  readonly channel = "sms" as const;

  private accountSid: string | undefined;
  private authToken: string | undefined;
  private fromNumber: string | undefined;

  constructor() {
    this.accountSid = process.env.TWILIO_ACCOUNT_SID;
    this.authToken = process.env.TWILIO_AUTH_TOKEN;
    this.fromNumber = process.env.TWILIO_FROM_NUMBER;
  }

  private get isConfigured(): boolean {
    return Boolean(this.accountSid && this.authToken && this.fromNumber);
  }

  async send(request: SendMessageRequest): Promise<SendMessageResult> {
    if (!this.isConfigured) {
      // Fallback: log and return a stub success
      const messageId = `sms-stub-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      console.log(
        `[SmsProvider] Stub send (no credentials) to=${request.to} body="${request.body.slice(0, 50)}..."`
      );
      return { success: true, messageId };
    }

    try {
      // Dynamic import to avoid loading Twilio in environments without it
      const twilio = await import("twilio");
      const createClient = twilio.default ?? twilio;
      const client = createClient(this.accountSid!, this.authToken!);

      const message = await client.messages.create({
        to: request.to,
        from: this.fromNumber!,
        body: request.body,
      });

      return { success: true, messageId: message.sid };
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : "Unknown Twilio error";
      console.error(`[SmsProvider] Twilio error: ${errorMsg}`);
      return { success: false, error: errorMsg };
    }
  }
}
