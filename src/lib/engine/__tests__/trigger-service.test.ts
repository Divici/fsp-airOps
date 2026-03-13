import { describe, it, expect, vi, beforeEach } from "vitest";
import { TriggerService } from "../trigger-service";
import type { Orchestrator } from "../orchestrator";
import type { SchedulingTrigger } from "@/lib/db/schema";
import type { EngineExecutionResult } from "../types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

// ---------------------------------------------------------------------------
// Mocks for DB query functions
// ---------------------------------------------------------------------------

const mockCreateTrigger = vi.fn();
const mockGetTriggerById = vi.fn();
const mockUpdateTriggerStatus = vi.fn();
const mockIsDuplicateTrigger = vi.fn();
const mockMarkTriggerProcessed = vi.fn();

vi.mock("@/lib/db/queries/triggers", () => ({
  createTrigger: (...args: unknown[]) => mockCreateTrigger(...args),
  getTriggerById: (...args: unknown[]) => mockGetTriggerById(...args),
  updateTriggerStatus: (...args: unknown[]) =>
    mockUpdateTriggerStatus(...args),
  isDuplicateTrigger: (...args: unknown[]) =>
    mockIsDuplicateTrigger(...args),
  markTriggerProcessed: (...args: unknown[]) =>
    mockMarkTriggerProcessed(...args),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockDb = {} as PostgresJsDatabase;

function makeTrigger(
  overrides: Partial<SchedulingTrigger> = {}
): SchedulingTrigger {
  return {
    id: "trigger-1",
    operatorId: 1,
    type: "cancellation",
    status: "pending",
    sourceEntityId: null,
    sourceEntityType: null,
    context: null,
    processedAt: null,
    error: null,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...overrides,
  };
}

function makeOrchestrator(
  result?: Partial<EngineExecutionResult>
): Orchestrator {
  return {
    executeWorkflow: vi.fn().mockResolvedValue({
      triggerId: "trigger-1",
      proposalId: "proposal-1",
      success: true,
      auditTrail: [],
      ...result,
    }),
  } as unknown as Orchestrator;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("TriggerService", () => {
  let orchestrator: Orchestrator;
  let service: TriggerService;

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementations
    mockCreateTrigger.mockResolvedValue("trigger-1");
    mockGetTriggerById.mockResolvedValue(makeTrigger());
    mockUpdateTriggerStatus.mockResolvedValue(undefined);
    mockIsDuplicateTrigger.mockResolvedValue(false);
    mockMarkTriggerProcessed.mockResolvedValue(undefined);

    orchestrator = makeOrchestrator();
    service = new TriggerService(mockDb, orchestrator);
  });

  // -------------------------------------------------------------------------
  // createAndDispatch
  // -------------------------------------------------------------------------

  describe("createAndDispatch", () => {
    it("creates trigger and dispatches to orchestrator", async () => {
      const result = await service.createAndDispatch({
        operatorId: 1,
        type: "cancellation",
        sourceEntityId: "res-123",
        sourceEntityType: "reservation",
      });

      expect(result.triggerId).toBe("trigger-1");
      expect(result.dispatched).toBe(true);
      expect(result.duplicate).toBe(false);
      expect(result.result?.success).toBe(true);

      // Verify orchestrator was called
      expect(orchestrator.executeWorkflow).toHaveBeenCalledTimes(1);

      // Verify trigger was marked processed on success
      expect(mockMarkTriggerProcessed).toHaveBeenCalledWith(
        mockDb,
        1,
        "trigger-1"
      );
    });

    it("detects and skips duplicates", async () => {
      mockIsDuplicateTrigger.mockResolvedValue(true);

      const result = await service.createAndDispatch({
        operatorId: 1,
        type: "cancellation",
        sourceEntityId: "res-123",
      });

      expect(result.duplicate).toBe(true);
      expect(result.dispatched).toBe(false);
      expect(result.triggerId).toBe("");

      // Should NOT create trigger or call orchestrator
      expect(mockCreateTrigger).not.toHaveBeenCalled();
      expect(orchestrator.executeWorkflow).not.toHaveBeenCalled();
    });

    it("updates trigger status to completed on success", async () => {
      await service.createAndDispatch({
        operatorId: 1,
        type: "cancellation",
        sourceEntityId: "res-123",
      });

      // Status set to processing before dispatch
      expect(mockUpdateTriggerStatus).toHaveBeenCalledWith(
        mockDb,
        1,
        "trigger-1",
        "processing"
      );

      // Then marked as processed (completed) on success
      expect(mockMarkTriggerProcessed).toHaveBeenCalledWith(
        mockDb,
        1,
        "trigger-1"
      );
    });

    it("updates trigger status to failed on orchestrator error", async () => {
      orchestrator = makeOrchestrator({
        success: false,
        error: "Workflow failed",
      });
      service = new TriggerService(mockDb, orchestrator);

      const result = await service.createAndDispatch({
        operatorId: 1,
        type: "cancellation",
        sourceEntityId: "res-123",
      });

      expect(result.result?.success).toBe(false);
      expect(mockUpdateTriggerStatus).toHaveBeenCalledWith(
        mockDb,
        1,
        "trigger-1",
        "failed",
        "Workflow failed"
      );
      expect(mockMarkTriggerProcessed).not.toHaveBeenCalled();
    });

    it("handles orchestrator throwing an exception", async () => {
      orchestrator = {
        executeWorkflow: vi
          .fn()
          .mockRejectedValue(new Error("Unexpected crash")),
      } as unknown as Orchestrator;
      service = new TriggerService(mockDb, orchestrator);

      const result = await service.createAndDispatch({
        operatorId: 1,
        type: "cancellation",
        sourceEntityId: "res-123",
      });

      expect(result.dispatched).toBe(true);
      expect(result.result?.success).toBe(false);
      expect(result.result?.error).toBe("Unexpected crash");
      expect(mockUpdateTriggerStatus).toHaveBeenCalledWith(
        mockDb,
        1,
        "trigger-1",
        "failed",
        "Unexpected crash"
      );
    });

    it("skips dedup check when sourceEntityId is not provided", async () => {
      await service.createAndDispatch({
        operatorId: 1,
        type: "manual",
      });

      expect(mockIsDuplicateTrigger).not.toHaveBeenCalled();
      expect(mockCreateTrigger).toHaveBeenCalled();
      expect(orchestrator.executeWorkflow).toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // createTrigger (without dispatch)
  // -------------------------------------------------------------------------

  describe("createTrigger", () => {
    it("creates trigger without dispatching", async () => {
      const result = await service.createTrigger({
        operatorId: 1,
        type: "cancellation",
        sourceEntityId: "res-456",
      });

      expect(result.triggerId).toBe("trigger-1");
      expect(result.duplicate).toBe(false);
      expect(mockCreateTrigger).toHaveBeenCalled();

      // Should NOT dispatch
      expect(orchestrator.executeWorkflow).not.toHaveBeenCalled();
    });

    it("returns duplicate true when duplicate detected", async () => {
      mockIsDuplicateTrigger.mockResolvedValue(true);

      const result = await service.createTrigger({
        operatorId: 1,
        type: "cancellation",
        sourceEntityId: "res-456",
      });

      expect(result.duplicate).toBe(true);
      expect(result.triggerId).toBe("");
      expect(mockCreateTrigger).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // dispatchTrigger
  // -------------------------------------------------------------------------

  describe("dispatchTrigger", () => {
    it("dispatches an existing trigger", async () => {
      const result = await service.dispatchTrigger(1, "trigger-1");

      expect(result.success).toBe(true);
      expect(result.proposalId).toBe("proposal-1");
      expect(mockGetTriggerById).toHaveBeenCalledWith(
        mockDb,
        1,
        "trigger-1"
      );
      expect(orchestrator.executeWorkflow).toHaveBeenCalledTimes(1);
      expect(mockMarkTriggerProcessed).toHaveBeenCalledWith(
        mockDb,
        1,
        "trigger-1"
      );
    });

    it("throws when trigger not found", async () => {
      mockGetTriggerById.mockResolvedValue(null);

      await expect(
        service.dispatchTrigger(1, "nonexistent")
      ).rejects.toThrow("Trigger nonexistent not found");
    });

    it("marks trigger failed when orchestrator returns failure", async () => {
      orchestrator = makeOrchestrator({
        success: false,
        error: "Handler missing",
      });
      service = new TriggerService(mockDb, orchestrator);

      const result = await service.dispatchTrigger(1, "trigger-1");

      expect(result.success).toBe(false);
      expect(mockUpdateTriggerStatus).toHaveBeenCalledWith(
        mockDb,
        1,
        "trigger-1",
        "failed",
        "Handler missing"
      );
    });
  });
});
