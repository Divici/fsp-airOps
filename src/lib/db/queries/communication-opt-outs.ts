// ---------------------------------------------------------------------------
// Communication Opt-Out queries — per-student opt-in/out for notifications
// ---------------------------------------------------------------------------

import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { and, eq } from "drizzle-orm";
import { communicationOptOuts } from "@/lib/db/schema";
import type { CommunicationChannel } from "@/lib/comms/types";

/**
 * Check whether a student has opted out of a specific communication channel.
 */
export async function isOptedOut(
  db: PostgresJsDatabase,
  operatorId: number,
  studentId: string,
  channel: CommunicationChannel
): Promise<boolean> {
  const rows = await db
    .select({ id: communicationOptOuts.id })
    .from(communicationOptOuts)
    .where(
      and(
        eq(communicationOptOuts.operatorId, operatorId),
        eq(communicationOptOuts.studentId, studentId),
        eq(communicationOptOuts.channel, channel)
      )
    )
    .limit(1);

  return rows.length > 0;
}

/**
 * Record an opt-out for a student on a specific channel.
 * Uses an upsert — silently ignores if the opt-out already exists.
 */
export async function optOut(
  db: PostgresJsDatabase,
  operatorId: number,
  studentId: string,
  channel: CommunicationChannel
): Promise<void> {
  await db
    .insert(communicationOptOuts)
    .values({ operatorId, studentId, channel })
    .onConflictDoNothing({
      target: [
        communicationOptOuts.operatorId,
        communicationOptOuts.studentId,
        communicationOptOuts.channel,
      ],
    });
}

/**
 * Remove an opt-out record, effectively opting the student back in.
 */
export async function optIn(
  db: PostgresJsDatabase,
  operatorId: number,
  studentId: string,
  channel: CommunicationChannel
): Promise<void> {
  await db
    .delete(communicationOptOuts)
    .where(
      and(
        eq(communicationOptOuts.operatorId, operatorId),
        eq(communicationOptOuts.studentId, studentId),
        eq(communicationOptOuts.channel, channel)
      )
    );
}

/**
 * Get the opt-out status for both channels for a given student.
 */
export async function getOptOutStatus(
  db: PostgresJsDatabase,
  operatorId: number,
  studentId: string
): Promise<{ email: boolean; sms: boolean }> {
  const rows = await db
    .select({ channel: communicationOptOuts.channel })
    .from(communicationOptOuts)
    .where(
      and(
        eq(communicationOptOuts.operatorId, operatorId),
        eq(communicationOptOuts.studentId, studentId)
      )
    );

  const channels = new Set(rows.map((r) => r.channel));

  return {
    email: channels.has("email"),
    sms: channels.has("sms"),
  };
}
