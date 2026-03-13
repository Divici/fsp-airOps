// ---------------------------------------------------------------------------
// Session management — placeholder until real FSP auth is integrated.
// ---------------------------------------------------------------------------

import { getEnv } from "@/config/env";
import type { UserSession } from "./types";
import { DEV_DEFAULT_OPERATOR_ID } from "./tenant-context";

/** Placeholder type for the raw FSP auth response. */
export interface FspAuthResponse {
  userId: string;
  email: string;
  token: string;
  operators: number[];
}

/**
 * Retrieve the current user session.
 *
 * In mock mode returns a dev session; in production this will read from
 * cookies / encrypted session storage (to be implemented).
 */
export async function getCurrentSession(): Promise<UserSession | null> {
  const env = getEnv();

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

  // TODO: implement real session resolution (cookie → decrypt → UserSession)
  return null;
}

/**
 * Create a new session from an FSP auth response.
 * Placeholder — will persist to an encrypted cookie or DB-backed session store.
 */
export async function createSession(
  authResponse: FspAuthResponse,
  operatorId: number
): Promise<UserSession> {
  const session: UserSession = {
    userId: authResponse.userId,
    email: authResponse.email,
    operatorId,
    operators: authResponse.operators,
    token: authResponse.token,
    expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000), // 8 h
  };

  // TODO: persist session (e.g. encrypted cookie)
  return session;
}
