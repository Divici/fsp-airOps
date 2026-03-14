// ---------------------------------------------------------------------------
// SMS Provider — stub for future Twilio/similar integration
// ---------------------------------------------------------------------------

import type {
  CommunicationProvider,
  SendMessageRequest,
  SendMessageResult,
} from "./types";

/**
 * SMS adapter placeholder. Will be replaced with Twilio or similar
 * when the SMS integration is implemented.
 */
export class SmsProvider implements CommunicationProvider {
  readonly channel = "sms" as const;

  async send(request: SendMessageRequest): Promise<SendMessageResult> {
    // TODO: integrate with Twilio or similar SMS provider
    const messageId = `sms-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    console.log(
      `[SmsProvider] Stub send to=${request.to} body="${request.body.slice(0, 50)}..."`
    );

    return {
      success: true,
      messageId,
    };
  }
}
