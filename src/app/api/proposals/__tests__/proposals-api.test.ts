import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock modules before importing route handlers
// ---------------------------------------------------------------------------

const mockListProposals = vi.fn();
const mockGetProposalById = vi.fn();
const mockUpdateProposalStatus = vi.fn();
const mockCreateApprovalDecision = vi.fn();
const mockLogProposalApproved = vi.fn();
const mockLogProposalDeclined = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {},
}));

vi.mock("@/lib/db/queries/proposals", () => ({
  listProposals: (...args: unknown[]) => mockListProposals(...args),
  getProposalById: (...args: unknown[]) => mockGetProposalById(...args),
  updateProposalStatus: (...args: unknown[]) =>
    mockUpdateProposalStatus(...args),
}));

vi.mock("@/lib/db/queries/approvals", () => ({
  createApprovalDecision: (...args: unknown[]) =>
    mockCreateApprovalDecision(...args),
}));

vi.mock("@/lib/engine/audit", () => ({
  AuditService: vi.fn().mockImplementation(() => ({
    logProposalApproved: (...args: unknown[]) =>
      mockLogProposalApproved(...args),
    logProposalDeclined: (...args: unknown[]) =>
      mockLogProposalDeclined(...args),
  })),
}));

// Mock tenant resolution: default to mock mode with dev fallback
vi.mock("@/config/env", () => ({
  getEnv: () => ({ FSP_ENVIRONMENT: "mock" }),
}));

vi.mock("@/lib/auth/session", () => ({
  getCurrentSession: vi.fn().mockResolvedValue(null),
}));

// Import route handlers after mocks
import { GET as listHandler } from "../route";
import { GET as detailHandler } from "../[id]/route";
import { POST as approveHandler } from "../[id]/approve/route";
import { POST as declineHandler } from "../[id]/decline/route";

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

const PROPOSAL_UUID = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";

function makePendingProposal(overrides?: Record<string, unknown>) {
  return {
    id: PROPOSAL_UUID,
    operatorId: 1,
    workflowType: "reschedule",
    triggerId: "trigger-1",
    status: "pending",
    summary: "Test proposal",
    rationale: "Test rationale",
    priority: 0,
    expiresAt: null,
    affectedStudentIds: [],
    affectedReservationIds: [],
    affectedResourceIds: [],
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    actions: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /api/proposals — List proposals", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns proposals with pagination for the tenant", async () => {
    const proposals = [makePendingProposal()];
    mockListProposals.mockResolvedValue({ proposals, total: 1 });

    const req = makeRequestWithTenant(
      "http://localhost/api/proposals?page=1&limit=10",
      1
    );
    const res = await listHandler(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.proposals).toHaveLength(1);
    expect(body.total).toBe(1);
    expect(body.page).toBe(1);
    expect(body.limit).toBe(10);
    expect(body.totalPages).toBe(1);

    expect(mockListProposals).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        operatorId: 1,
        limit: 10,
        offset: 0,
      })
    );
  });

  it("passes status and workflowType filters", async () => {
    mockListProposals.mockResolvedValue({ proposals: [], total: 0 });

    const req = makeRequestWithTenant(
      "http://localhost/api/proposals?status=pending&workflowType=reschedule",
      1
    );
    await listHandler(req);

    expect(mockListProposals).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        status: "pending",
        workflowType: "reschedule",
      })
    );
  });

  it("returns 400 for invalid query parameters", async () => {
    const req = makeRequestWithTenant(
      "http://localhost/api/proposals?status=invalid_status",
      1
    );
    const res = await listHandler(req);

    expect(res.status).toBe(400);
  });
});

describe("GET /api/proposals/:id — Get proposal detail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns proposal with actions", async () => {
    const proposal = makePendingProposal({ actions: [{ id: "action-1" }] });
    mockGetProposalById.mockResolvedValue(proposal);

    const req = makeRequestWithTenant(
      `http://localhost/api/proposals/${PROPOSAL_UUID}`,
      1
    );
    const res = await detailHandler(req, {
      params: Promise.resolve({ id: PROPOSAL_UUID }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.proposal.id).toBe(PROPOSAL_UUID);
    expect(body.proposal.actions).toHaveLength(1);
  });

  it("returns 404 for missing proposal", async () => {
    mockGetProposalById.mockResolvedValue(null);

    const req = makeRequestWithTenant(
      `http://localhost/api/proposals/${PROPOSAL_UUID}`,
      1
    );
    const res = await detailHandler(req, {
      params: Promise.resolve({ id: PROPOSAL_UUID }),
    });

    expect(res.status).toBe(404);
  });
});

describe("POST /api/proposals/:id/approve — Approve proposal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("approves a pending proposal and creates approval record", async () => {
    const proposal = makePendingProposal();
    mockGetProposalById.mockResolvedValue(proposal);
    mockUpdateProposalStatus.mockResolvedValue(undefined);
    mockCreateApprovalDecision.mockResolvedValue("approval-1");
    mockLogProposalApproved.mockResolvedValue(undefined);

    const req = makeRequestWithTenant(
      `http://localhost/api/proposals/${PROPOSAL_UUID}/approve`,
      1,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: "Looks good" }),
      }
    );

    const res = await approveHandler(req, {
      params: Promise.resolve({ id: PROPOSAL_UUID }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.status).toBe("approved");
    expect(body.approvalId).toBe("approval-1");

    // Verify status was updated
    expect(mockUpdateProposalStatus).toHaveBeenCalledWith(
      expect.anything(),
      1,
      PROPOSAL_UUID,
      "approved"
    );

    // Verify approval decision was created
    expect(mockCreateApprovalDecision).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        proposalId: PROPOSAL_UUID,
        operatorId: 1,
        decision: "approved",
        notes: "Looks good",
      })
    );

    // Verify audit was logged
    expect(mockLogProposalApproved).toHaveBeenCalledWith(
      1,
      PROPOSAL_UUID,
      "test-user-1"
    );
  });

  it("returns 409 for non-pending proposal", async () => {
    const proposal = makePendingProposal({ status: "executed" });
    mockGetProposalById.mockResolvedValue(proposal);

    const req = makeRequestWithTenant(
      `http://localhost/api/proposals/${PROPOSAL_UUID}/approve`,
      1,
      { method: "POST" }
    );

    const res = await approveHandler(req, {
      params: Promise.resolve({ id: PROPOSAL_UUID }),
    });

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toContain("Invalid proposal status transition");
  });

  it("returns 404 for non-existent proposal", async () => {
    mockGetProposalById.mockResolvedValue(null);

    const req = makeRequestWithTenant(
      `http://localhost/api/proposals/${PROPOSAL_UUID}/approve`,
      1,
      { method: "POST" }
    );

    const res = await approveHandler(req, {
      params: Promise.resolve({ id: PROPOSAL_UUID }),
    });

    expect(res.status).toBe(404);
  });
});

describe("POST /api/proposals/:id/decline — Decline proposal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("declines a pending proposal with reason", async () => {
    const proposal = makePendingProposal();
    mockGetProposalById.mockResolvedValue(proposal);
    mockUpdateProposalStatus.mockResolvedValue(undefined);
    mockCreateApprovalDecision.mockResolvedValue("approval-2");
    mockLogProposalDeclined.mockResolvedValue(undefined);

    const req = makeRequestWithTenant(
      `http://localhost/api/proposals/${PROPOSAL_UUID}/decline`,
      1,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Student unavailable" }),
      }
    );

    const res = await declineHandler(req, {
      params: Promise.resolve({ id: PROPOSAL_UUID }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.status).toBe("declined");

    // Verify approval decision was created with reason as notes
    expect(mockCreateApprovalDecision).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        proposalId: PROPOSAL_UUID,
        decision: "declined",
        notes: "Student unavailable",
      })
    );

    // Verify audit was logged with reason
    expect(mockLogProposalDeclined).toHaveBeenCalledWith(
      1,
      PROPOSAL_UUID,
      "test-user-1",
      "Student unavailable"
    );
  });

  it("declines without reason", async () => {
    const proposal = makePendingProposal();
    mockGetProposalById.mockResolvedValue(proposal);
    mockUpdateProposalStatus.mockResolvedValue(undefined);
    mockCreateApprovalDecision.mockResolvedValue("approval-3");
    mockLogProposalDeclined.mockResolvedValue(undefined);

    const req = makeRequestWithTenant(
      `http://localhost/api/proposals/${PROPOSAL_UUID}/decline`,
      1,
      { method: "POST" }
    );

    const res = await declineHandler(req, {
      params: Promise.resolve({ id: PROPOSAL_UUID }),
    });

    expect(res.status).toBe(200);
  });

  it("returns 409 for already declined proposal", async () => {
    const proposal = makePendingProposal({ status: "declined" });
    mockGetProposalById.mockResolvedValue(proposal);

    const req = makeRequestWithTenant(
      `http://localhost/api/proposals/${PROPOSAL_UUID}/decline`,
      1,
      { method: "POST" }
    );

    const res = await declineHandler(req, {
      params: Promise.resolve({ id: PROPOSAL_UUID }),
    });

    expect(res.status).toBe(409);
  });
});

describe("Tenant enforcement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // In mock mode, missing operator header falls back to dev defaults.
  // To test 401, we need to override the env mock to non-mock mode.
  // Instead, test with an invalid operator ID.
  it("returns 401 for invalid operator ID header", async () => {
    const req = new Request("http://localhost/api/proposals", {
      headers: { "x-operator-id": "not-a-number" },
    });
    const res = await listHandler(req);
    expect(res.status).toBe(401);
  });

  it("returns 401 for negative operator ID header", async () => {
    const req = new Request("http://localhost/api/proposals", {
      headers: { "x-operator-id": "-1" },
    });
    const res = await listHandler(req);
    expect(res.status).toBe(401);
  });
});
