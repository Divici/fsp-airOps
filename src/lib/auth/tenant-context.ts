// ---------------------------------------------------------------------------
// Tenant context resolution — ensures every request is scoped to an operator.
// ---------------------------------------------------------------------------

import { getEnv } from "@/config/env";
import type { TenantContext, UserSession } from "./types";
import { getCurrentSession } from "./session";

/** Default operatorId used in mock/dev mode when no auth is configured. */
export const DEV_DEFAULT_OPERATOR_ID = 1;
const DEV_DEFAULT_USER_ID = "dev-user-000";

// ---- Errors ----------------------------------------------------------------

export class TenantResolutionError extends Error {
  public readonly statusCode: number;

  constructor(message: string, statusCode: number = 401) {
    super(message);
    this.name = "TenantResolutionError";
    this.statusCode = statusCode;
  }
}

// ---- Resolution helpers ----------------------------------------------------

/**
 * Resolve tenant context from an incoming Request (API routes).
 * Reads `x-operator-id` and `x-user-id` headers.
 * Falls back to dev defaults in mock mode.
 */
export function getTenantFromRequest(request: Request): TenantContext {
  const env = getEnv();
  const isMock = env.FSP_ENVIRONMENT === "mock";

  const operatorIdRaw = request.headers.get("x-operator-id");
  const userId = request.headers.get("x-user-id");

  if (operatorIdRaw) {
    const operatorId = Number(operatorIdRaw);
    if (!Number.isFinite(operatorId) || operatorId <= 0) {
      throw new TenantResolutionError(
        "x-operator-id header must be a positive integer"
      );
    }
    return {
      operatorId,
      userId: userId ?? (isMock ? DEV_DEFAULT_USER_ID : ""),
    };
  }

  // No header — allow dev fallback in mock mode only
  if (isMock) {
    return {
      operatorId: DEV_DEFAULT_OPERATOR_ID,
      userId: DEV_DEFAULT_USER_ID,
    };
  }

  throw new TenantResolutionError(
    "Missing x-operator-id header — tenant context required"
  );
}

/**
 * Resolve tenant context from the current session (server components / actions).
 * Falls back to dev defaults in mock mode.
 */
export async function getTenantFromSession(): Promise<TenantContext> {
  const env = getEnv();
  const isMock = env.FSP_ENVIRONMENT === "mock";

  const session = await getCurrentSession();

  if (session) {
    return {
      operatorId: session.operatorId,
      userId: session.userId,
    };
  }

  if (isMock) {
    return {
      operatorId: DEV_DEFAULT_OPERATOR_ID,
      userId: DEV_DEFAULT_USER_ID,
    };
  }

  throw new TenantResolutionError(
    "No active session — tenant context required"
  );
}

/**
 * Validate that the given operatorId is accessible by the current user session.
 */
export function validateTenantAccess(
  session: UserSession,
  operatorId: number
): boolean {
  return session.operators.includes(operatorId);
}
