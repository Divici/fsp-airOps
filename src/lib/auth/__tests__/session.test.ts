// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from "vitest";
import { SignJWT } from "jose";

// --- Mocks -------------------------------------------------------------------

// Mock next/headers cookies
const mockCookieStore = {
  get: vi.fn(),
  set: vi.fn(),
};

vi.mock("next/headers", () => ({
  cookies: vi.fn(() => Promise.resolve(mockCookieStore)),
}));

vi.mock("@/config/env", () => ({
  getEnv: vi.fn(() => ({ FSP_ENVIRONMENT: "production" })),
}));

// We need to import after mocks
import { getEnv } from "@/config/env";
import {
  createSession,
  getCurrentSession,
  destroySession,
  verifySessionToken,
  SESSION_COOKIE_NAME,
} from "../session";

const mockGetEnv = vi.mocked(getEnv);

const DEV_SECRET = "fsp-dev-secret-do-not-use-in-production-000";
const secretKey = new TextEncoder().encode(DEV_SECRET);

describe("session management", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetEnv.mockReturnValue({ FSP_ENVIRONMENT: "production" } as ReturnType<typeof getEnv>);
  });

  describe("createSession", () => {
    it("sets an httpOnly cookie and returns a UserSession", async () => {
      const session = await createSession({
        userId: "user-123",
        operatorId: 42,
        token: "fsp-bearer-token",
        email: "pilot@example.com",
        operators: [{ id: 42, name: "Sky Academy" }],
      });

      expect(session.userId).toBe("user-123");
      expect(session.operatorId).toBe(42);
      expect(session.email).toBe("pilot@example.com");
      expect(session.token).toBe("fsp-bearer-token");
      expect(session.operators).toEqual([42]);
      expect(session.expiresAt).toBeInstanceOf(Date);
      expect(session.expiresAt.getTime()).toBeGreaterThan(Date.now());

      // Verify cookie was set
      expect(mockCookieStore.set).toHaveBeenCalledTimes(1);
      const [cookieName, cookieValue, options] = mockCookieStore.set.mock.calls[0];
      expect(cookieName).toBe(SESSION_COOKIE_NAME);
      expect(typeof cookieValue).toBe("string");
      expect(options.httpOnly).toBe(true);
      expect(options.sameSite).toBe("lax");
      expect(options.path).toBe("/");
    });

    it("creates a session with default operators when none provided", async () => {
      const session = await createSession({
        userId: "user-456",
        operatorId: 7,
        token: "tok",
      });

      expect(session.operatorId).toBe(7);
      expect(session.operators).toEqual([7]);
    });
  });

  describe("getCurrentSession", () => {
    it("returns session from a valid cookie", async () => {
      // Create a valid JWT
      const jwt = await new SignJWT({
        uid: "user-abc",
        oid: 10,
        tok: "bearer-tok",
        eml: "test@example.com",
        ops: [{ id: 10, name: "Test Operator" }],
      })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("1h")
        .sign(secretKey);

      mockCookieStore.get.mockReturnValue({ value: jwt });

      const session = await getCurrentSession();

      expect(session).not.toBeNull();
      expect(session!.userId).toBe("user-abc");
      expect(session!.operatorId).toBe(10);
      expect(session!.email).toBe("test@example.com");
      expect(session!.token).toBe("bearer-tok");
    });

    it("returns null when no cookie is present (production mode)", async () => {
      mockCookieStore.get.mockReturnValue(undefined);

      const session = await getCurrentSession();
      expect(session).toBeNull();
    });

    it("returns mock session when no cookie in mock mode", async () => {
      mockGetEnv.mockReturnValue({ FSP_ENVIRONMENT: "mock" } as ReturnType<typeof getEnv>);
      mockCookieStore.get.mockReturnValue(undefined);

      const session = await getCurrentSession();
      expect(session).not.toBeNull();
      expect(session!.userId).toBe("dev-user-000");
      expect(session!.operatorId).toBe(1);
    });

    it("returns null for an invalid token", async () => {
      mockCookieStore.get.mockReturnValue({ value: "garbage-token" });

      const session = await getCurrentSession();
      expect(session).toBeNull();
    });

    it("returns null for an expired token", async () => {
      const jwt = await new SignJWT({
        uid: "user-expired",
        oid: 1,
        tok: "tok",
        eml: "expired@example.com",
        ops: [],
      })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt(Math.floor(Date.now() / 1000) - 3600)
        .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
        .sign(secretKey);

      mockCookieStore.get.mockReturnValue({ value: jwt });

      const session = await getCurrentSession();
      expect(session).toBeNull();
    });
  });

  describe("destroySession", () => {
    it("clears the session cookie with maxAge 0", async () => {
      await destroySession();

      expect(mockCookieStore.set).toHaveBeenCalledTimes(1);
      const [name, value, options] = mockCookieStore.set.mock.calls[0];
      expect(name).toBe(SESSION_COOKIE_NAME);
      expect(value).toBe("");
      expect(options.maxAge).toBe(0);
    });
  });

  describe("verifySessionToken", () => {
    it("returns UserSession for a valid token", async () => {
      const jwt = await new SignJWT({
        uid: "user-verify",
        oid: 5,
        tok: "fsp-tok",
        eml: "verify@example.com",
        ops: [{ id: 5, name: "VerifyOp" }],
      })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("2h")
        .sign(secretKey);

      const session = await verifySessionToken(jwt);

      expect(session).not.toBeNull();
      expect(session!.userId).toBe("user-verify");
      expect(session!.operatorId).toBe(5);
    });

    it("returns null for a token signed with a different secret", async () => {
      const wrongKey = new TextEncoder().encode("wrong-secret-key");
      const jwt = await new SignJWT({ uid: "x", oid: 1, tok: "t", eml: "", ops: [] })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("1h")
        .sign(wrongKey);

      const session = await verifySessionToken(jwt);
      expect(session).toBeNull();
    });

    it("returns null for empty string", async () => {
      const session = await verifySessionToken("");
      expect(session).toBeNull();
    });
  });
});
