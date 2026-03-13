import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks — must be declared before importing route modules
// ---------------------------------------------------------------------------

const mockGetTenantFromRequest = vi.fn();

vi.mock("@/lib/auth/tenant-context", () => ({
  getTenantFromRequest: (...args: unknown[]) =>
    mockGetTenantFromRequest(...args),
  TenantResolutionError: class TenantResolutionError extends Error {
    public readonly statusCode: number;
    constructor(message: string, statusCode: number = 401) {
      super(message);
      this.name = "TenantResolutionError";
      this.statusCode = statusCode;
    }
  },
}));

const mockCreateAndDispatch = vi.fn();

vi.mock("@/lib/engine/trigger-service", () => ({
  TriggerService: vi.fn().mockImplementation(() => ({
    createAndDispatch: mockCreateAndDispatch,
  })),
}));

vi.mock("@/lib/db", () => ({
  db: {},
}));

vi.mock("@/lib/engine", () => ({
  createOrchestrator: vi.fn().mockReturnValue({}),
}));

vi.mock("@/lib/fsp-client", () => ({
  createFspClient: vi.fn().mockReturnValue({}),
}));

// ---------------------------------------------------------------------------
// Import route handlers after mocks are set up
// ---------------------------------------------------------------------------

import { POST as cancellationPOST } from "../cancellation/route";
import { POST as evaluatePOST } from "../evaluate/route";
import { TenantResolutionError } from "@/lib/auth/tenant-context";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(body: unknown, headers?: Record<string, string>): Request {
  return new Request("http://localhost/api/triggers/cancellation", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-operator-id": "1",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

function makeEvalRequest(
  body?: unknown,
  headers?: Record<string, string>
): Request {
  return new Request("http://localhost/api/triggers/evaluate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-operator-id": "1",
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : "{}",
  });
}

const validCancellationBody = {
  operatorId: 1,
  cancelledReservationId: "res-123",
  cancelledStudentId: "student-456",
  cancelledInstructorId: "instr-789",
  cancelledAircraftId: "aircraft-001",
  originalStart: "2026-03-15T10:00:00Z",
  originalEnd: "2026-03-15T12:00:00Z",
  locationId: 1,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Trigger API Endpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetTenantFromRequest.mockReturnValue({
      operatorId: 1,
      userId: "dev-user-000",
    });
    mockCreateAndDispatch.mockResolvedValue({
      triggerId: "trigger-001",
      dispatched: true,
      duplicate: false,
    });
  });

  // -------------------------------------------------------------------------
  // Cancellation Trigger
  // -------------------------------------------------------------------------

  describe("POST /api/triggers/cancellation", () => {
    it("creates trigger and returns triggerId on valid body", async () => {
      const request = makeRequest(validCancellationBody);
      const response = await cancellationPOST(request);
      const json = await response.json();

      expect(response.status).toBe(201);
      expect(json.triggerId).toBe("trigger-001");
      expect(json.dispatched).toBe(true);
      expect(json.duplicate).toBe(false);

      expect(mockCreateAndDispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          operatorId: 1,
          type: "cancellation",
          sourceEntityId: "res-123",
          sourceEntityType: "reservation",
        })
      );
    });

    it("returns duplicate=true when trigger is a duplicate", async () => {
      mockCreateAndDispatch.mockResolvedValue({
        triggerId: "",
        dispatched: false,
        duplicate: true,
      });

      const request = makeRequest(validCancellationBody);
      const response = await cancellationPOST(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.duplicate).toBe(true);
      expect(json.dispatched).toBe(false);
    });

    it("returns 400 on missing required fields", async () => {
      const request = makeRequest({
        operatorId: 1,
        // Missing required fields
      });
      const response = await cancellationPOST(request);
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.error).toBe("Invalid request body");
      expect(json.details).toBeDefined();
    });

    it("returns 400 when locationId is invalid", async () => {
      const request = makeRequest({
        ...validCancellationBody,
        locationId: -1,
      });
      const response = await cancellationPOST(request);

      expect(response.status).toBe(400);
    });

    it("returns 401 when tenant resolution fails", async () => {
      mockGetTenantFromRequest.mockImplementation(() => {
        throw new TenantResolutionError(
          "Missing x-operator-id header — tenant context required"
        );
      });

      const request = makeRequest(validCancellationBody);
      const response = await cancellationPOST(request);
      const json = await response.json();

      expect(response.status).toBe(401);
      expect(json.error).toContain("tenant context required");
    });
  });

  // -------------------------------------------------------------------------
  // Manual Evaluation Trigger
  // -------------------------------------------------------------------------

  describe("POST /api/triggers/evaluate", () => {
    it("creates manual trigger successfully", async () => {
      const request = makeEvalRequest({ workflowType: "reschedule" });
      const response = await evaluatePOST(request);
      const json = await response.json();

      expect(response.status).toBe(201);
      expect(json.triggerId).toBe("trigger-001");
      expect(json.dispatched).toBe(true);

      expect(mockCreateAndDispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          operatorId: 1,
          type: "manual",
          context: expect.objectContaining({
            workflowType: "reschedule",
          }),
        })
      );
    });

    it("works with empty body", async () => {
      const request = makeEvalRequest({});
      const response = await evaluatePOST(request);
      const json = await response.json();

      expect(response.status).toBe(201);
      expect(json.triggerId).toBe("trigger-001");
    });

    it("returns 401 when tenant resolution fails", async () => {
      mockGetTenantFromRequest.mockImplementation(() => {
        throw new TenantResolutionError(
          "Missing x-operator-id header — tenant context required"
        );
      });

      const request = makeEvalRequest({});
      const response = await evaluatePOST(request);

      expect(response.status).toBe(401);
    });
  });
});
