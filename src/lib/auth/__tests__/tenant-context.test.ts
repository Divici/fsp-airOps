// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock the env module before importing tenant-context
vi.mock("@/config/env", () => ({
  getEnv: vi.fn(),
}));

// Mock session module
vi.mock("@/lib/auth/session", () => ({
  getCurrentSession: vi.fn(),
}));

import { getEnv } from "@/config/env";
import { getCurrentSession } from "@/lib/auth/session";
import {
  getTenantFromRequest,
  getTenantFromSession,
  validateTenantAccess,
  TenantResolutionError,
  DEV_DEFAULT_OPERATOR_ID,
} from "../tenant-context";
import type { UserSession } from "../types";

const mockGetEnv = vi.mocked(getEnv);
const mockGetCurrentSession = vi.mocked(getCurrentSession);

function makeRequest(headers: Record<string, string> = {}): Request {
  return new Request("http://localhost:3000/api/test", { headers });
}

describe("getTenantFromRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resolves operatorId from x-operator-id header", () => {
    mockGetEnv.mockReturnValue({ FSP_ENVIRONMENT: "production" } as ReturnType<typeof getEnv>);

    const ctx = getTenantFromRequest(
      makeRequest({ "x-operator-id": "42", "x-user-id": "user-abc" })
    );

    expect(ctx.operatorId).toBe(42);
    expect(ctx.userId).toBe("user-abc");
  });

  it("uses dev default userId when x-user-id is missing in mock mode", () => {
    mockGetEnv.mockReturnValue({ FSP_ENVIRONMENT: "mock" } as ReturnType<typeof getEnv>);

    const ctx = getTenantFromRequest(makeRequest({ "x-operator-id": "5" }));

    expect(ctx.operatorId).toBe(5);
    expect(ctx.userId).toBe("dev-user-000");
  });

  it("throws TenantResolutionError when x-operator-id is missing in production", () => {
    mockGetEnv.mockReturnValue({ FSP_ENVIRONMENT: "production" } as ReturnType<typeof getEnv>);

    expect(() => getTenantFromRequest(makeRequest())).toThrow(
      TenantResolutionError
    );
    expect(() => getTenantFromRequest(makeRequest())).toThrow(
      "Missing x-operator-id header"
    );
  });

  it("throws TenantResolutionError for invalid x-operator-id values", () => {
    mockGetEnv.mockReturnValue({ FSP_ENVIRONMENT: "production" } as ReturnType<typeof getEnv>);

    expect(() =>
      getTenantFromRequest(makeRequest({ "x-operator-id": "abc" }))
    ).toThrow("positive integer");

    expect(() =>
      getTenantFromRequest(makeRequest({ "x-operator-id": "-1" }))
    ).toThrow("positive integer");

    expect(() =>
      getTenantFromRequest(makeRequest({ "x-operator-id": "0" }))
    ).toThrow("positive integer");
  });

  it("falls back to dev defaults in mock mode when no headers provided", () => {
    mockGetEnv.mockReturnValue({ FSP_ENVIRONMENT: "mock" } as ReturnType<typeof getEnv>);

    const ctx = getTenantFromRequest(makeRequest());

    expect(ctx.operatorId).toBe(DEV_DEFAULT_OPERATOR_ID);
    expect(ctx.userId).toBe("dev-user-000");
  });
});

describe("getTenantFromSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resolves from an active session", async () => {
    mockGetEnv.mockReturnValue({ FSP_ENVIRONMENT: "production" } as ReturnType<typeof getEnv>);
    mockGetCurrentSession.mockResolvedValue({
      userId: "user-123",
      email: "test@example.com",
      operatorId: 7,
      operators: [7],
      token: "tok",
      expiresAt: new Date(),
    });

    const ctx = await getTenantFromSession();
    expect(ctx.operatorId).toBe(7);
    expect(ctx.userId).toBe("user-123");
  });

  it("falls back to dev defaults in mock mode when no session exists", async () => {
    mockGetEnv.mockReturnValue({ FSP_ENVIRONMENT: "mock" } as ReturnType<typeof getEnv>);
    mockGetCurrentSession.mockResolvedValue(null);

    const ctx = await getTenantFromSession();
    expect(ctx.operatorId).toBe(DEV_DEFAULT_OPERATOR_ID);
  });

  it("throws when no session in production mode", async () => {
    mockGetEnv.mockReturnValue({ FSP_ENVIRONMENT: "production" } as ReturnType<typeof getEnv>);
    mockGetCurrentSession.mockResolvedValue(null);

    await expect(getTenantFromSession()).rejects.toThrow(
      TenantResolutionError
    );
  });
});

describe("validateTenantAccess", () => {
  const baseSession: UserSession = {
    userId: "user-1",
    email: "u@example.com",
    operatorId: 1,
    operators: [1, 2, 5],
    token: "tok",
    expiresAt: new Date(),
  };

  it("returns true when the operator is in the user's list", () => {
    expect(validateTenantAccess(baseSession, 1)).toBe(true);
    expect(validateTenantAccess(baseSession, 5)).toBe(true);
  });

  it("returns false when the operator is not in the user's list", () => {
    expect(validateTenantAccess(baseSession, 99)).toBe(false);
  });
});
