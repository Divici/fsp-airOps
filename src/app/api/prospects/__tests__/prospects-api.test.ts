import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock modules before importing route handlers
// ---------------------------------------------------------------------------

const mockCreateProspectRequest = vi.fn();
const mockListProspectRequests = vi.fn();
const mockGetProspectById = vi.fn();
const mockUpdateProspectStatus = vi.fn();
const mockCreateAndDispatch = vi.fn();

vi.mock("@/lib/db", () => ({
  db: { update: vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn() }) }) },
}));

vi.mock("@/lib/db/schema", () => ({
  prospectRequests: { id: "id" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
}));

vi.mock("@/lib/db/queries/prospects", () => ({
  createProspectRequest: (...args: unknown[]) =>
    mockCreateProspectRequest(...args),
  listProspectRequests: (...args: unknown[]) =>
    mockListProspectRequests(...args),
  getProspectById: (...args: unknown[]) => mockGetProspectById(...args),
  updateProspectStatus: (...args: unknown[]) =>
    mockUpdateProspectStatus(...args),
}));

vi.mock("@/lib/fsp-client", () => ({
  createFspClient: () => ({}),
}));

vi.mock("@/lib/engine", () => ({
  createOrchestrator: () => ({}),
}));

vi.mock("@/lib/engine/trigger-service", () => ({
  TriggerService: class {
    createAndDispatch = (...args: unknown[]) => mockCreateAndDispatch(...args);
  },
}));

// Mock tenant resolution: default to mock mode with dev fallback
vi.mock("@/config/env", () => ({
  getEnv: () => ({ FSP_ENVIRONMENT: "mock" }),
}));

vi.mock("@/lib/auth/session", () => ({
  getCurrentSession: vi.fn().mockResolvedValue(null),
}));

// Import route handlers after mocks
import { GET as listHandler, POST as createHandler } from "../route";
import { GET as detailHandler, PATCH as patchHandler } from "../[id]/route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequestWithTenant(
  url: string,
  operatorId: number,
  options?: RequestInit
): Request {
  return new Request(url, {
    ...options,
    headers: {
      "x-operator-id": String(operatorId),
      "x-user-id": "test-user-1",
      ...(options?.headers || {}),
    },
  });
}

const PROSPECT_UUID = "b1c2d3e4-f5a6-4b7c-8d9e-0f1a2b3c4d5e";

function makeProspect(overrides?: Record<string, unknown>) {
  return {
    id: PROSPECT_UUID,
    operatorId: 1,
    firstName: "Jane",
    lastName: "Doe",
    email: "jane@example.com",
    phone: "555-1234",
    preferredLocationId: null,
    preferredDateStart: null,
    preferredDateEnd: null,
    preferredTimeWindows: null,
    notes: null,
    status: "new",
    linkedProposalId: null,
    linkedReservationId: null,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests — GET /api/prospects (List)
// ---------------------------------------------------------------------------

describe("GET /api/prospects — List prospects", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns prospects with pagination for the tenant", async () => {
    const prospects = [makeProspect()];
    mockListProspectRequests.mockResolvedValue({ prospects, total: 1 });

    const req = makeRequestWithTenant(
      "http://localhost/api/prospects?page=1&limit=10",
      1
    );
    const res = await listHandler(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.prospects).toHaveLength(1);
    expect(body.total).toBe(1);
    expect(body.page).toBe(1);
    expect(body.limit).toBe(10);
    expect(body.totalPages).toBe(1);

    expect(mockListProspectRequests).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        operatorId: 1,
        limit: 10,
        offset: 0,
      })
    );
  });

  it("passes status filter", async () => {
    mockListProspectRequests.mockResolvedValue({ prospects: [], total: 0 });

    const req = makeRequestWithTenant(
      "http://localhost/api/prospects?status=processing",
      1
    );
    await listHandler(req);

    expect(mockListProspectRequests).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        status: "processing",
      })
    );
  });

  it("returns 400 for invalid status", async () => {
    const req = makeRequestWithTenant(
      "http://localhost/api/prospects?status=invalid_status",
      1
    );
    const res = await listHandler(req);
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// Tests — POST /api/prospects (Create)
// ---------------------------------------------------------------------------

describe("POST /api/prospects — Create prospect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a prospect request and auto-triggers discovery workflow", async () => {
    const prospect = makeProspect();
    mockCreateProspectRequest.mockResolvedValue(prospect);
    mockCreateAndDispatch.mockResolvedValue({
      triggerId: "trigger-1",
      dispatched: true,
      duplicate: false,
      result: { triggerId: "trigger-1", proposalId: "proposal-1", success: true, auditTrail: [] },
    });
    mockUpdateProspectStatus.mockResolvedValue(undefined);

    const req = new Request("http://localhost/api/prospects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        operatorId: 1,
        firstName: "Jane",
        lastName: "Doe",
        email: "jane@example.com",
        phone: "555-1234",
      }),
    });

    const res = await createHandler(req);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.prospect.firstName).toBe("Jane");

    // Verify trigger was dispatched
    expect(mockCreateAndDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        operatorId: 1,
        type: "discovery_request",
        sourceEntityId: PROSPECT_UUID,
        sourceEntityType: "prospect_request",
      })
    );

    // Verify prospect status was advanced
    expect(mockUpdateProspectStatus).toHaveBeenCalled();
  });

  it("returns 400 for missing required fields", async () => {
    const req = new Request("http://localhost/api/prospects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        operatorId: 1,
        // missing firstName, lastName, email
      }),
    });

    const res = await createHandler(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid email", async () => {
    const req = new Request("http://localhost/api/prospects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        operatorId: 1,
        firstName: "Jane",
        lastName: "Doe",
        email: "not-an-email",
      }),
    });

    const res = await createHandler(req);
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// Tests — GET /api/prospects/:id (Detail)
// ---------------------------------------------------------------------------

describe("GET /api/prospects/:id — Get prospect detail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns prospect by ID", async () => {
    const prospect = makeProspect();
    mockGetProspectById.mockResolvedValue(prospect);

    const req = makeRequestWithTenant(
      `http://localhost/api/prospects/${PROSPECT_UUID}`,
      1
    );
    const res = await detailHandler(req, {
      params: Promise.resolve({ id: PROSPECT_UUID }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.prospect.id).toBe(PROSPECT_UUID);
  });

  it("returns 404 for missing prospect", async () => {
    mockGetProspectById.mockResolvedValue(null);

    const req = makeRequestWithTenant(
      `http://localhost/api/prospects/${PROSPECT_UUID}`,
      1
    );
    const res = await detailHandler(req, {
      params: Promise.resolve({ id: PROSPECT_UUID }),
    });

    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// Tests — PATCH /api/prospects/:id (Status update)
// ---------------------------------------------------------------------------

describe("PATCH /api/prospects/:id — Update prospect status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates status on a valid transition", async () => {
    const prospect = makeProspect({ status: "new" });
    mockGetProspectById.mockResolvedValue(prospect);
    mockUpdateProspectStatus.mockResolvedValue(undefined);

    const req = makeRequestWithTenant(
      `http://localhost/api/prospects/${PROSPECT_UUID}`,
      1,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "processing" }),
      }
    );

    const res = await patchHandler(req, {
      params: Promise.resolve({ id: PROSPECT_UUID }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.status).toBe("processing");
  });

  it("returns 409 for invalid status transition", async () => {
    const prospect = makeProspect({ status: "new" });
    mockGetProspectById.mockResolvedValue(prospect);
    mockUpdateProspectStatus.mockRejectedValue(
      new Error("Invalid prospect status transition: new \u2192 booked")
    );

    const req = makeRequestWithTenant(
      `http://localhost/api/prospects/${PROSPECT_UUID}`,
      1,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "booked" }),
      }
    );

    const res = await patchHandler(req, {
      params: Promise.resolve({ id: PROSPECT_UUID }),
    });

    expect(res.status).toBe(409);
  });

  it("returns 404 for non-existent prospect", async () => {
    mockGetProspectById.mockResolvedValue(null);

    const req = makeRequestWithTenant(
      `http://localhost/api/prospects/${PROSPECT_UUID}`,
      1,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "processing" }),
      }
    );

    const res = await patchHandler(req, {
      params: Promise.resolve({ id: PROSPECT_UUID }),
    });

    expect(res.status).toBe(404);
  });

  it("returns 400 for invalid status value", async () => {
    const req = makeRequestWithTenant(
      `http://localhost/api/prospects/${PROSPECT_UUID}`,
      1,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "nonexistent" }),
      }
    );

    const res = await patchHandler(req, {
      params: Promise.resolve({ id: PROSPECT_UUID }),
    });

    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// Tests — Tenant enforcement
// ---------------------------------------------------------------------------

describe("Tenant enforcement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 for invalid operator ID header", async () => {
    const req = new Request("http://localhost/api/prospects", {
      headers: { "x-operator-id": "not-a-number" },
    });
    const res = await listHandler(req);
    expect(res.status).toBe(401);
  });
});
