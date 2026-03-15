import { describe, it, expect, vi, beforeEach } from "vitest";
import { ReservationExecutor } from "../reservation-executor";
import type { ProposalWithActions } from "@/lib/db/queries/proposals";
import type { ProposalAction } from "@/lib/db/schema";
import type { IFspClient } from "@/lib/fsp-client/types";
import type { AuditService } from "@/lib/engine/audit";
import type { FspReservationResponse, FspScheduleResponse } from "@/lib/types/fsp";

// ---------------------------------------------------------------------------
// Mock DB query module
// ---------------------------------------------------------------------------

const mockGetProposalById = vi.fn();
const mockUpdateProposalStatus = vi.fn();
const mockUpdateActionExecutionStatus = vi.fn();

vi.mock("@/lib/db/queries/proposals", () => ({
  getProposalById: (...args: unknown[]) => mockGetProposalById(...args),
  updateProposalStatus: (...args: unknown[]) => mockUpdateProposalStatus(...args),
  updateActionExecutionStatus: (...args: unknown[]) =>
    mockUpdateActionExecutionStatus(...args),
}));

// Mock assertTransition — let it pass by default; individual tests can override
const mockAssertTransition = vi.fn();
vi.mock("@/lib/engine/proposal-lifecycle", () => ({
  assertTransition: (...args: unknown[]) => mockAssertTransition(...args),
}));

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const OPERATOR_ID = 1;
const PROPOSAL_ID = "proposal-001";
const ACTION_ID_1 = "action-001";
const ACTION_ID_2 = "action-002";

function makeAction(overrides: Partial<ProposalAction> = {}): ProposalAction {
  return {
    id: ACTION_ID_1,
    proposalId: PROPOSAL_ID,
    operatorId: OPERATOR_ID,
    rank: 1,
    actionType: "create_reservation",
    startTime: new Date("2026-03-16T16:00:00Z"), // UTC
    endTime: new Date("2026-03-16T18:00:00Z"),
    locationId: 1,
    studentId: "student-1",
    instructorId: "inst-1",
    aircraftId: "ac-1",
    activityTypeId: "at-1",
    trainingContext: null,
    explanation: null,
    validationStatus: "pending",
    executionStatus: "pending",
    executionError: null,
    fspReservationId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeProposal(
  actions: ProposalAction[] = [makeAction()]
): ProposalWithActions {
  return {
    id: PROPOSAL_ID,
    operatorId: OPERATOR_ID,
    workflowType: "reschedule",
    triggerId: "trigger-1",
    status: "approved",
    priority: 0,
    summary: "Test proposal",
    rationale: "Test",
    affectedStudentIds: null,
    affectedReservationIds: null,
    affectedResourceIds: null,
    validationSnapshot: null,
    expiresAt: null,
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    actions,
  };
}

function emptySchedule(): FspScheduleResponse {
  return { results: { events: [], resources: [], unavailability: [] } };
}

function validationOk(): FspReservationResponse {
  return { id: undefined, errors: [] };
}

function createOk(id = "res-123"): FspReservationResponse {
  return { id, errors: [] };
}

// ---------------------------------------------------------------------------
// Mock FSP client factory
// ---------------------------------------------------------------------------

function makeMockFspClient(
  overrides: Partial<IFspClient> = {}
): IFspClient {
  return {
    authenticate: vi.fn(),
    refreshSession: vi.fn(),
    getLocations: vi.fn(),
    getAircraft: vi.fn(),
    getInstructors: vi.fn(),
    getActivityTypes: vi.fn(),
    getSchedulingGroups: vi.fn(),
    getUsers: vi.fn(),
    getAvailability: vi.fn(),
    getSchedule: vi.fn().mockResolvedValue(emptySchedule()),
    getSchedulableEvents: vi.fn(),
    findATime: vi.fn(),
    autoSchedule: vi.fn(),
    validateReservation: vi.fn().mockResolvedValue(validationOk()),
    createReservation: vi.fn().mockResolvedValue(createOk()),
    getReservation: vi.fn(),
    listReservations: vi.fn(),
    batchCreateReservations: vi.fn().mockResolvedValue({ batchId: "batch-123", status: "completed" }),
    getBatchStatus: vi.fn().mockResolvedValue({ batchId: "batch-123", status: "completed", results: [] }),
    getEnrollments: vi.fn(),
    getEnrollmentProgress: vi.fn(),
    getCivilTwilight: vi.fn(),
    ...overrides,
  } as IFspClient;
}

// ---------------------------------------------------------------------------
// Mock audit service factory
// ---------------------------------------------------------------------------

function makeMockAuditService(): AuditService {
  return {
    logEvent: vi.fn(),
    logTriggerReceived: vi.fn(),
    logProposalGenerated: vi.fn(),
    logProposalApproved: vi.fn(),
    logProposalDeclined: vi.fn(),
    logReservationCreated: vi.fn(),
    logReservationFailed: vi.fn(),
    getEventsForEntity: vi.fn(),
    getRecentEvents: vi.fn(),
  } as unknown as AuditService;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ReservationExecutor", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mockDb = {} as any;
  let fspClient: IFspClient;
  let auditService: ReturnType<typeof makeMockAuditService>;
  let executor: ReservationExecutor;

  beforeEach(() => {
    vi.clearAllMocks();
    fspClient = makeMockFspClient();
    auditService = makeMockAuditService();

    mockAssertTransition.mockImplementation(() => {
      /* pass */
    });
    mockGetProposalById.mockResolvedValue(makeProposal());
    mockUpdateProposalStatus.mockResolvedValue(undefined);
    mockUpdateActionExecutionStatus.mockResolvedValue(undefined);

    executor = new ReservationExecutor(mockDb, fspClient, auditService, {
      timezoneResolver: () => "America/Los_Angeles",
    });
  });

  // -----------------------------------------------------------------------
  // 1. Success path
  // -----------------------------------------------------------------------

  it("executes a single-action proposal successfully", async () => {
    const result = await executor.executeProposal(OPERATOR_ID, PROPOSAL_ID);

    expect(result.success).toBe(true);
    expect(result.results).toHaveLength(1);
    expect(result.results[0].fspReservationId).toBe("res-123");
    expect(result.errors).toHaveLength(0);

    // Proposal status updated to executed
    expect(mockUpdateProposalStatus).toHaveBeenCalledWith(
      mockDb,
      OPERATOR_ID,
      PROPOSAL_ID,
      "executed"
    );

    // Action status updated through the pipeline
    expect(mockUpdateActionExecutionStatus).toHaveBeenCalledWith(
      mockDb,
      OPERATOR_ID,
      ACTION_ID_1,
      { validationStatus: "valid" }
    );
    expect(mockUpdateActionExecutionStatus).toHaveBeenCalledWith(
      mockDb,
      OPERATOR_ID,
      ACTION_ID_1,
      { executionStatus: "created", fspReservationId: "res-123" }
    );
  });

  // -----------------------------------------------------------------------
  // 2. Stale slot
  // -----------------------------------------------------------------------

  it("fails when freshness check detects a stale slot", async () => {
    const conflictSchedule: FspScheduleResponse = {
      results: {
        events: [
          {
            Start: "2026-03-16T16:00:00Z",
            End: "2026-03-16T18:00:00Z",
            Title: "Conflict",
            CustomerName: "Other",
            InstructorName: "inst-1",
            AircraftName: "ac-1",
          },
        ],
        resources: [],
        unavailability: [],
      },
    };

    (fspClient.getSchedule as ReturnType<typeof vi.fn>).mockResolvedValue(
      conflictSchedule
    );

    const result = await executor.executeProposal(OPERATOR_ID, PROPOSAL_ID);

    expect(result.success).toBe(false);
    expect(result.results[0].success).toBe(false);
    expect(result.results[0].error).toContain("already booked");

    expect(mockUpdateActionExecutionStatus).toHaveBeenCalledWith(
      mockDb,
      OPERATOR_ID,
      ACTION_ID_1,
      expect.objectContaining({
        validationStatus: "stale",
        executionStatus: "failed",
      })
    );

    expect(mockUpdateProposalStatus).toHaveBeenCalledWith(
      mockDb,
      OPERATOR_ID,
      PROPOSAL_ID,
      "failed"
    );
  });

  // -----------------------------------------------------------------------
  // 3. Validation failure
  // -----------------------------------------------------------------------

  it("fails when FSP validation returns errors", async () => {
    (fspClient.validateReservation as ReturnType<typeof vi.fn>).mockResolvedValue({
      errors: [
        { message: "Aircraft not available", field: "aircraftId" },
        { message: "Instructor conflict", field: "instructorId" },
      ],
    });

    const result = await executor.executeProposal(OPERATOR_ID, PROPOSAL_ID);

    expect(result.success).toBe(false);
    expect(result.results[0].error).toBe(
      "Aircraft not available; Instructor conflict"
    );

    expect(mockUpdateActionExecutionStatus).toHaveBeenCalledWith(
      mockDb,
      OPERATOR_ID,
      ACTION_ID_1,
      expect.objectContaining({
        validationStatus: "invalid",
        executionStatus: "failed",
      })
    );
  });

  // -----------------------------------------------------------------------
  // 4. Creation failure
  // -----------------------------------------------------------------------

  it("fails when FSP create returns errors after successful validation", async () => {
    (fspClient.createReservation as ReturnType<typeof vi.fn>).mockResolvedValue({
      errors: [{ message: "Unexpected server error", field: "unknown" }],
    });

    const result = await executor.executeProposal(OPERATOR_ID, PROPOSAL_ID);

    expect(result.success).toBe(false);
    expect(result.results[0].error).toBe("Unexpected server error");

    // Validation passed, but creation failed
    expect(mockUpdateActionExecutionStatus).toHaveBeenCalledWith(
      mockDb,
      OPERATOR_ID,
      ACTION_ID_1,
      { validationStatus: "valid" }
    );
    expect(mockUpdateActionExecutionStatus).toHaveBeenCalledWith(
      mockDb,
      OPERATOR_ID,
      ACTION_ID_1,
      expect.objectContaining({
        executionStatus: "failed",
        executionError: "Unexpected server error",
      })
    );
  });

  // -----------------------------------------------------------------------
  // 5. Partial success — multiple actions, one fails
  // -----------------------------------------------------------------------

  it("marks proposal as failed when one of multiple actions fails", async () => {
    const action1 = makeAction({ id: ACTION_ID_1, rank: 1 });
    const action2 = makeAction({ id: ACTION_ID_2, rank: 2 });
    mockGetProposalById.mockResolvedValue(makeProposal([action1, action2]));

    // First action succeeds, second fails validation
    let callCount = 0;
    (fspClient.validateReservation as ReturnType<typeof vi.fn>).mockImplementation(
      () => {
        callCount++;
        if (callCount === 2) {
          return Promise.resolve({
            errors: [{ message: "Conflict", field: "time" }],
          });
        }
        return Promise.resolve(validationOk());
      }
    );

    const result = await executor.executeProposal(OPERATOR_ID, PROPOSAL_ID);

    expect(result.success).toBe(false);
    expect(result.results).toHaveLength(2);
    expect(result.results[0].success).toBe(true);
    expect(result.results[1].success).toBe(false);
    expect(result.errors).toEqual(["Conflict"]);

    expect(mockUpdateProposalStatus).toHaveBeenCalledWith(
      mockDb,
      OPERATOR_ID,
      PROPOSAL_ID,
      "failed"
    );
  });

  // -----------------------------------------------------------------------
  // 6. Audit trail
  // -----------------------------------------------------------------------

  it("logs audit events at each step of a successful execution", async () => {
    await executor.executeProposal(OPERATOR_ID, PROPOSAL_ID);

    // validation_passed
    expect(auditService.logEvent).toHaveBeenCalledWith(
      OPERATOR_ID,
      "validation_passed",
      expect.objectContaining({
        entityId: ACTION_ID_1,
        entityType: "proposal_action",
      })
    );

    // reservation_created (via convenience method)
    expect(auditService.logReservationCreated).toHaveBeenCalledWith(
      OPERATOR_ID,
      ACTION_ID_1,
      "res-123"
    );
  });

  it("logs audit event when freshness check fails", async () => {
    const conflictSchedule: FspScheduleResponse = {
      results: {
        events: [
          {
            Start: "2026-03-16T16:00:00Z",
            End: "2026-03-16T18:00:00Z",
            Title: "Conflict",
            CustomerName: "Other",
            InstructorName: "inst-1",
            AircraftName: "ac-1",
          },
        ],
        resources: [],
        unavailability: [],
      },
    };

    (fspClient.getSchedule as ReturnType<typeof vi.fn>).mockResolvedValue(
      conflictSchedule
    );

    await executor.executeProposal(OPERATOR_ID, PROPOSAL_ID);

    expect(auditService.logEvent).toHaveBeenCalledWith(
      OPERATOR_ID,
      "validation_failed",
      expect.objectContaining({
        entityId: ACTION_ID_1,
        entityType: "proposal_action",
      })
    );
  });

  it("logs audit event when validation fails", async () => {
    (fspClient.validateReservation as ReturnType<typeof vi.fn>).mockResolvedValue({
      errors: [{ message: "Bad request", field: "start" }],
    });

    await executor.executeProposal(OPERATOR_ID, PROPOSAL_ID);

    expect(auditService.logEvent).toHaveBeenCalledWith(
      OPERATOR_ID,
      "validation_failed",
      expect.objectContaining({
        entityId: ACTION_ID_1,
        payload: expect.objectContaining({
          errors: [{ message: "Bad request", field: "start" }],
        }),
      })
    );
  });

  it("logs reservation failed when create fails", async () => {
    (fspClient.createReservation as ReturnType<typeof vi.fn>).mockResolvedValue({
      errors: [{ message: "Server error", field: "unknown" }],
    });

    await executor.executeProposal(OPERATOR_ID, PROPOSAL_ID);

    expect(auditService.logReservationFailed).toHaveBeenCalledWith(
      OPERATOR_ID,
      ACTION_ID_1,
      "Server error"
    );
  });

  // -----------------------------------------------------------------------
  // 7. Local time conversion
  // -----------------------------------------------------------------------

  it("converts UTC times to local time in reservation payload", async () => {
    // Action has UTC times: 2026-03-16T16:00Z and 2026-03-16T18:00Z
    // In America/Los_Angeles (PDT, UTC-7), that's 09:00 and 11:00
    await executor.executeProposal(OPERATOR_ID, PROPOSAL_ID);

    expect(fspClient.validateReservation).toHaveBeenCalledWith(
      OPERATOR_ID,
      expect.objectContaining({
        start: "2026-03-16T09:00",
        end: "2026-03-16T11:00",
      })
    );

    expect(fspClient.createReservation).toHaveBeenCalledWith(
      OPERATOR_ID,
      expect.objectContaining({
        start: "2026-03-16T09:00",
        end: "2026-03-16T11:00",
      })
    );
  });

  it("builds reservation payload with correct fields from action", async () => {
    await executor.executeProposal(OPERATOR_ID, PROPOSAL_ID);

    expect(fspClient.createReservation).toHaveBeenCalledWith(
      OPERATOR_ID,
      expect.objectContaining({
        operatorId: OPERATOR_ID,
        locationId: 1,
        aircraftId: "ac-1",
        activityTypeId: "at-1",
        pilotId: "student-1",
        instructorId: "inst-1",
      })
    );
  });

  // -----------------------------------------------------------------------
  // Edge cases
  // -----------------------------------------------------------------------

  it("throws when proposal is not found", async () => {
    mockGetProposalById.mockResolvedValue(null);

    await expect(
      executor.executeProposal(OPERATOR_ID, PROPOSAL_ID)
    ).rejects.toThrow("Proposal not found");
  });

  it("throws when proposal status transition is invalid", async () => {
    mockAssertTransition.mockImplementation(() => {
      throw new Error("Invalid proposal status transition: 'pending' -> 'executed'");
    });

    await expect(
      executor.executeProposal(OPERATOR_ID, PROPOSAL_ID)
    ).rejects.toThrow("Invalid proposal status transition");
  });

  it("handles unexpected errors during action execution gracefully", async () => {
    (fspClient.getSchedule as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Network timeout")
    );

    const result = await executor.executeProposal(OPERATOR_ID, PROPOSAL_ID);

    expect(result.success).toBe(false);
    expect(result.results[0].error).toBe("Network timeout");

    expect(mockUpdateActionExecutionStatus).toHaveBeenCalledWith(
      mockDb,
      OPERATOR_ID,
      ACTION_ID_1,
      expect.objectContaining({
        executionStatus: "failed",
        executionError: "Network timeout",
      })
    );

    expect(auditService.logReservationFailed).toHaveBeenCalledWith(
      OPERATOR_ID,
      ACTION_ID_1,
      "Network timeout"
    );
  });

  // -----------------------------------------------------------------------
  // Batch mode tests
  // -----------------------------------------------------------------------

  describe("batch mode", () => {
    let batchExecutor: ReservationExecutor;

    beforeEach(() => {
      batchExecutor = new ReservationExecutor(mockDb, fspClient, auditService, {
        timezoneResolver: () => "America/Los_Angeles",
        batchMode: true,
        batchPollIntervalMs: 0, // no delay in tests
        batchMaxPolls: 3,
      });
    });

    it("uses batch API when multiple actions and batch mode is enabled", async () => {
      const action1 = makeAction({ id: ACTION_ID_1, rank: 1 });
      const action2 = makeAction({ id: ACTION_ID_2, rank: 2 });
      mockGetProposalById.mockResolvedValue(makeProposal([action1, action2]));

      (fspClient.getBatchStatus as ReturnType<typeof vi.fn>).mockResolvedValue({
        batchId: "batch-123",
        status: "completed",
        results: [
          { reservationId: 1001 },
          { reservationId: 1002 },
        ],
      });

      const result = await batchExecutor.executeProposal(OPERATOR_ID, PROPOSAL_ID);

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(2);
      expect(fspClient.batchCreateReservations).toHaveBeenCalledTimes(1);
    });

    it("falls back to sequential when batch API throws", async () => {
      const action1 = makeAction({ id: ACTION_ID_1, rank: 1 });
      const action2 = makeAction({ id: ACTION_ID_2, rank: 2 });
      mockGetProposalById.mockResolvedValue(makeProposal([action1, action2]));

      (fspClient.batchCreateReservations as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Batch not supported")
      );

      const result = await batchExecutor.executeProposal(OPERATOR_ID, PROPOSAL_ID);

      // Falls back to sequential — should still succeed
      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(2);
      expect(fspClient.createReservation).toHaveBeenCalledTimes(2);
    });

    it("uses sequential for single-action proposals even in batch mode", async () => {
      const result = await batchExecutor.executeProposal(OPERATOR_ID, PROPOSAL_ID);

      expect(result.success).toBe(true);
      expect(fspClient.batchCreateReservations).not.toHaveBeenCalled();
      expect(fspClient.createReservation).toHaveBeenCalledTimes(1);
    });
  });
});
