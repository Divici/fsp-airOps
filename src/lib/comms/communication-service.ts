// ---------------------------------------------------------------------------
// CommunicationService — orchestrates sending and recording communications
// ---------------------------------------------------------------------------

import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { eq, and, desc } from "drizzle-orm";
import { communicationRecords } from "@/lib/db/schema";
import type { CommunicationRecord } from "@/lib/db/schema";
import type {
  CommunicationChannel,
  CommunicationProvider,
  SendMessageResult,
} from "./types";

export interface SendParams {
  operatorId: number;
  channel: CommunicationChannel;
  recipientId: string;
  to: string;
  subject?: string;
  body: string;
  templateId?: string;
  proposalId?: string;
  metadata?: Record<string, unknown>;
}

export interface HistoryFilters {
  channel?: CommunicationChannel;
  recipientId?: string;
  status?: CommunicationRecord["status"];
  limit?: number;
}

export class CommunicationService {
  private providers: Map<CommunicationChannel, CommunicationProvider> =
    new Map();

  constructor(private db: PostgresJsDatabase) {}

  /**
   * Register a provider for a given channel.
   */
  registerProvider(provider: CommunicationProvider): void {
    this.providers.set(provider.channel, provider);
  }

  /**
   * Send a message: records in DB, calls the appropriate provider,
   * then updates the record with the result.
   */
  async send(params: SendParams): Promise<SendMessageResult> {
    const provider = this.providers.get(params.channel);
    if (!provider) {
      // Record the failure and return
      await this.insertRecord(params, "failed", undefined, `No provider registered for channel: ${params.channel}`);
      return {
        success: false,
        error: `No provider registered for channel: ${params.channel}`,
      };
    }

    // Insert a pending record first
    const record = await this.insertRecord(params, "pending");

    // Attempt to send
    let result: SendMessageResult;
    try {
      result = await provider.send({
        channel: params.channel,
        to: params.to,
        subject: params.subject,
        body: params.body,
        metadata: params.metadata,
      });
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : "Unknown send error";
      await this.updateRecord(record.id, "failed", errorMsg);
      return { success: false, error: errorMsg };
    }

    // Update record based on result
    if (result.success) {
      await this.updateRecord(record.id, "sent");
    } else {
      await this.updateRecord(record.id, "failed", result.error);
    }

    return result;
  }

  /**
   * Get communication history for an operator.
   */
  async getHistory(
    operatorId: number,
    filters?: HistoryFilters
  ): Promise<CommunicationRecord[]> {
    const conditions = [eq(communicationRecords.operatorId, operatorId)];

    if (filters?.channel) {
      conditions.push(eq(communicationRecords.channel, filters.channel));
    }
    if (filters?.recipientId) {
      conditions.push(
        eq(communicationRecords.recipientId, filters.recipientId)
      );
    }
    if (filters?.status) {
      conditions.push(eq(communicationRecords.status, filters.status));
    }

    return this.db
      .select()
      .from(communicationRecords)
      .where(and(...conditions))
      .orderBy(desc(communicationRecords.createdAt))
      .limit(filters?.limit ?? 50);
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async insertRecord(
    params: SendParams,
    status: CommunicationRecord["status"],
    sentAt?: Date,
    error?: string
  ): Promise<CommunicationRecord> {
    const rows = await this.db
      .insert(communicationRecords)
      .values({
        operatorId: params.operatorId,
        channel: params.channel,
        recipientId: params.recipientId,
        recipientAddress: params.to,
        subject: params.subject ?? null,
        body: params.body,
        templateId: params.templateId ?? null,
        proposalId: params.proposalId ?? null,
        status,
        sentAt: sentAt ?? null,
        error: error ?? null,
      })
      .returning();

    return rows[0];
  }

  private async updateRecord(
    id: string,
    status: CommunicationRecord["status"],
    error?: string
  ): Promise<void> {
    await this.db
      .update(communicationRecords)
      .set({
        status,
        sentAt: status === "sent" ? new Date() : undefined,
        error: error ?? null,
      })
      .where(eq(communicationRecords.id, id));
  }
}
