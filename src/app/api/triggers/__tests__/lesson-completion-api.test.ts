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

import { POST as lessonCompletionPOST } from "../../triggers/lesson-completion/route";
import { TenantResolutionError } from "@/lib/auth/tenant-context";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(
  body: unknown,
  headers?: Record<string, string>,
): Request {
  return new Request("http://localhost/api/triggers/lesson-completion", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-operator-id": "1",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

const validBody = {
  operatorId: 1,
  studentId: "stu-aaa-1111",
  enrollmentId: "enr-001",
  completedEventId: "evt-007",
  completedInstructorId: "inst-aaa-1111",
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/triggers/lesson-completion", () => {
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

  it("creates trigger and returns triggerId on valid body", async () => {
    const request = makeRequest(validBody);
    const response = await lessonCompletionPOST(request);
    const json = await response.json();

    expect(response.status).toBe(201);
    expect(json.triggerId).toBe("trigger-001");
    expect(json.dispatched).toBe(true);
    expect(json.duplicate).toBe(false);

    expect(mockCreateAndDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        operatorId: 1,
        type: "lesson_complete",
        sourceEntityId: "evt-007",
        sourceEntityType: "schedulable_event",
      }),
    );
  });

  it("passes context with student and enrollment details", async () => {
    const request = makeRequest(validBody);
    await lessonCompletionPOST(request);

    expect(mockCreateAndDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        context: expect.objectContaining({
          studentId: "stu-aaa-1111",
          enrollmentId: "enr-001",
          completedEventId: "evt-007",
          completedInstructorId: "inst-aaa-1111",
        }),
      }),
    );
  });

  it("returns duplicate=true when trigger is a duplicate", async () => {
    mockCreateAndDispatch.mockResolvedValue({
      triggerId: "",
      dispatched: false,
      duplicate: true,
    });

    const request = makeRequest(validBody);
    const response = await lessonCompletionPOST(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.duplicate).toBe(true);
    expect(json.dispatched).toBe(false);
  });

  it("returns 400 on missing required fields", async () => {
    const request = makeRequest({
      operatorId: 1,
      // Missing studentId, enrollmentId, completedEventId
    });
    const response = await lessonCompletionPOST(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe("Invalid request body");
    expect(json.details).toBeDefined();
  });

  it("returns 400 when studentId is empty", async () => {
    const request = makeRequest({
      ...validBody,
      studentId: "",
    });
    const response = await lessonCompletionPOST(request);

    expect(response.status).toBe(400);
  });

  it("returns 401 when tenant resolution fails", async () => {
    mockGetTenantFromRequest.mockImplementation(() => {
      throw new TenantResolutionError(
        "Missing x-operator-id header — tenant context required",
      );
    });

    const request = makeRequest(validBody);
    const response = await lessonCompletionPOST(request);
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error).toContain("tenant context required");
  });

  it("works without optional completedInstructorId", async () => {
    const bodyWithoutInstructor = { ...validBody };
    delete (bodyWithoutInstructor as Record<string, unknown>)
      .completedInstructorId;

    const request = makeRequest(bodyWithoutInstructor);
    const response = await lessonCompletionPOST(request);

    expect(response.status).toBe(201);
  });
});
