// ---------------------------------------------------------------------------
// Unsubscribe token helpers — signed JWT for one-click unsubscribe links
// ---------------------------------------------------------------------------

import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import type { CommunicationChannel } from "./types";

/** Unsubscribe tokens are valid for 90 days. */
const TOKEN_EXPIRY = "90d";

const DEV_UNSUBSCRIBE_SECRET = "fsp-unsub-secret-do-not-use-in-production-000";

function getUnsubscribeSecret(): Uint8Array {
  const secret = process.env.UNSUBSCRIBE_SECRET || DEV_UNSUBSCRIBE_SECRET;
  return new TextEncoder().encode(secret);
}

interface UnsubscribePayload extends JWTPayload {
  sid: string; // studentId
  oid: number; // operatorId
  ch: CommunicationChannel; // channel
}

/**
 * Generate a signed JWT token for an unsubscribe link.
 */
export async function generateUnsubscribeToken(
  studentId: string,
  operatorId: number,
  channel: CommunicationChannel
): Promise<string> {
  return new SignJWT({
    sid: studentId,
    oid: operatorId,
    ch: channel,
  } satisfies Omit<UnsubscribePayload, keyof JWTPayload>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(TOKEN_EXPIRY)
    .sign(getUnsubscribeSecret());
}

/**
 * Verify and decode an unsubscribe token.
 * Returns null if the token is invalid or expired.
 */
export async function verifyUnsubscribeToken(
  token: string
): Promise<{ studentId: string; operatorId: number; channel: CommunicationChannel } | null> {
  try {
    const { payload } = await jwtVerify<UnsubscribePayload>(
      token,
      getUnsubscribeSecret()
    );

    if (!payload.sid || !payload.oid || !payload.ch) {
      return null;
    }

    return {
      studentId: payload.sid,
      operatorId: payload.oid,
      channel: payload.ch,
    };
  } catch {
    return null;
  }
}
