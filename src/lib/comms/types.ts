// ---------------------------------------------------------------------------
// Communication Service Types
// ---------------------------------------------------------------------------

export type CommunicationChannel = "email" | "sms";

export interface SendMessageRequest {
  channel: CommunicationChannel;
  to: string;
  subject?: string;
  body: string;
  /** Optional HTML version of the body for email clients that support it. */
  html?: string;
  metadata?: Record<string, unknown>;
}

export interface SendMessageResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Provider interface — each channel (email, SMS) implements this.
 * Providers handle the actual delivery; the CommunicationService
 * handles recording, templating, and orchestration.
 */
export interface CommunicationProvider {
  readonly channel: CommunicationChannel;
  send(request: SendMessageRequest): Promise<SendMessageResult>;
}
