// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from "vitest";

// --- Mocks -------------------------------------------------------------------

const mockCookieStore = {
  get: vi.fn(),
  set: vi.fn(),
};

vi.mock("next/headers", () => ({
  cookies: vi.fn(() => Promise.resolve(mockCookieStore)),
}));

vi.mock("@/config/env", () => ({
  getEnv: vi.fn(() => ({ FSP_ENVIRONMENT: "mock" })),
}));

vi.mock("@/lib/fsp-client", () => ({
  createFspClient: vi.fn(() => ({
    authenticate: vi.fn(),
  })),
}));

// Import route handlers after mocks
import { POST as loginPOST } from "../login/route";
import { POST as logoutPOST } from "../logout/route";
import { GET as sessionGET } from "../session/route";

function makeRequest(body?: unknown): Request {
  return new Request("http://localhost:3000/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe("POST /api/auth/login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Ensure mock mode for login tests
    process.env.FSP_ENVIRONMENT = "mock";
  });

  it("returns 400 when email is missing", async () => {
    const res = await loginPOST(makeRequest({ password: "pass" }));
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.error).toContain("Email and password");
  });

  it("returns 400 when password is missing", async () => {
    const res = await loginPOST(makeRequest({ email: "test@example.com" }));
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.error).toContain("Email and password");
  });

  it("succeeds in mock mode with any credentials", async () => {
    const res = await loginPOST(
      makeRequest({ email: "test@example.com", password: "anything" })
    );
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.operators).toBeInstanceOf(Array);
    expect(data.operators.length).toBeGreaterThan(0);

    // Verify a cookie was set
    expect(mockCookieStore.set).toHaveBeenCalled();
  });
});

describe("POST /api/auth/logout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("clears the session cookie and returns success", async () => {
    const res = await logoutPOST();
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);

    // Verify cookie was cleared
    expect(mockCookieStore.set).toHaveBeenCalledWith(
      "fsp-session",
      "",
      expect.objectContaining({ maxAge: 0 })
    );
  });
});

describe("GET /api/auth/session", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when no session cookie is present (mock fallback removed for logout support)", async () => {
    mockCookieStore.get.mockReturnValue(undefined);

    const res = await sessionGET();
    expect(res.status).toBe(401);
  });
});
