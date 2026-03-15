// ---------------------------------------------------------------------------
// Session management — encrypted JWT cookie-based sessions.
// ---------------------------------------------------------------------------

import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { cookies } from "next/headers";
import { getEnv } from "@/config/env";
import type { UserSession } from "./types";
import { DEV_DEFAULT_OPERATOR_ID } from "./tenant-context";

/** Cookie name used for the session token. */
export const SESSION_COOKIE_NAME = "fsp-session";

/** Session duration in hours. */
const SESSION_DURATION_HOURS = 8;

/** Placeholder type for the raw FSP auth response. */
export interface FspAuthResponse {
  userId: string;
  email: string;
  token: string;
  operators: number[];
}

/** Data needed to create a session. */
export interface CreateSessionData {
  userId: string;
  operatorId: number;
  token: string;
  email?: string;
  operators?: Array<{ id: number; name: string }>;
}

// ---- Secret key management -------------------------------------------------

const DEV_SECRET = "fsp-dev-secret-do-not-use-in-production-000";

function getSecretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET || DEV_SECRET;
  return new TextEncoder().encode(secret);
}

// ---- JWT payload shape -----------------------------------------------------

interface SessionPayload extends JWTPayload {
  uid: string;
  oid: number;
  tok: string;
  eml: string;
  ops: Array<{ id: number; name: string }>;
}

// ---- Public API ------------------------------------------------------------

/**
 * Create a new session and set the encrypted cookie.
 * Must be called from a Server Action or Route Handler (needs `cookies()`).
 */
export async function createSession(data: CreateSessionData): Promise<UserSession> {
  const expiresAt = new Date(Date.now() + SESSION_DURATION_HOURS * 60 * 60 * 1000);
  const operators = data.operators ?? [{ id: data.operatorId, name: "Operator" }];

  const jwt = await new SignJWT({
    uid: data.userId,
    oid: data.operatorId,
    tok: data.token,
    eml: data.email ?? "",
    ops: operators,
  } satisfies Omit<SessionPayload, keyof JWTPayload>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(getSecretKey());

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, jwt, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });

  return {
    userId: data.userId,
    email: data.email ?? "",
    operatorId: data.operatorId,
    operators: operators.map((o) => o.id),
    token: data.token,
    expiresAt,
  };
}

/**
 * Retrieve the current user session from the cookie.
 * Returns null if no cookie, expired, or invalid signature.
 *
 * In mock mode returns a dev session when no cookie is present.
 */
export async function getCurrentSession(): Promise<UserSession | null> {
  const env = getEnv();

  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);

    if (sessionCookie?.value) {
      const session = await verifySessionToken(sessionCookie.value);
      if (session) return session;
    }
  } catch {
    // cookies() may throw in middleware or edge contexts — fall through
  }

  // Mock mode fallback
  if (env.FSP_ENVIRONMENT === "mock") {
    return {
      userId: "dev-user-000",
      email: "dev@example.com",
      operatorId: DEV_DEFAULT_OPERATOR_ID,
      operators: [DEV_DEFAULT_OPERATOR_ID],
      token: "mock-token",
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    };
  }

  return null;
}

/**
 * Destroy the current session by clearing the cookie.
 */
export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

/**
 * Verify a JWT session token and return the UserSession, or null if invalid.
 * Exported for use in middleware where `cookies()` is not available.
 */
export async function verifySessionToken(token: string): Promise<UserSession | null> {
  try {
    const { payload } = await jwtVerify<SessionPayload>(token, getSecretKey());

    return {
      userId: payload.uid,
      email: payload.eml ?? "",
      operatorId: payload.oid,
      operators: (payload.ops ?? []).map((o) => o.id),
      token: payload.tok,
      expiresAt: new Date((payload.exp ?? 0) * 1000),
    };
  } catch {
    return null;
  }
}
