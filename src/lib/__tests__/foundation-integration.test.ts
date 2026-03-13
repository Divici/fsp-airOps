// @vitest-environment node
// ---------------------------------------------------------------------------
// Foundation Integration Smoke Tests
// Verifies that DB queries (mocked), FSP mock client, tenant context,
// audit service, and operator settings hang together correctly.
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// 1. Mock external dependencies so we never need a real DB or env vars
// ---------------------------------------------------------------------------

vi.mock("@/config/env", () => ({
  getEnv: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getCurrentSession: vi.fn(),
}));

vi.mock("@/lib/db/queries/audit", () => ({
  insertAuditEvent: vi.fn().mockResolvedValue({
    id: "mock-uuid",
    operatorId: 42,
    eventType: "trigger_received",
    entityId: null,
    entityType: null,
    payload: null,
    createdAt: new Date("2026-03-13"),
  }),
  queryAuditEvents: vi.fn().mockResolvedValue({ events: [], total: 0 }),
}));

// ---------------------------------------------------------------------------
// 2. Imports (after mocks are registered)
// ---------------------------------------------------------------------------

import { getEnv } from "@/config/env";
import {
  getTenantFromRequest,
  TenantResolutionError,
} from "@/lib/auth/tenant-context";
import { MockFspClient } from "@/lib/fsp-client/mock";
import { AuditService } from "@/lib/engine/audit";
import * as auditQueries from "@/lib/db/queries/audit";
import { DEFAULT_OPERATOR_SETTINGS } from "@/config/defaults";
import { withTenant, withTenantAnd } from "@/lib/db/queries/base";
import { AUDIT_EVENT_TYPES } from "@/lib/types/audit";
import { integer, pgTable, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockGetEnv = vi.mocked(getEnv);

function makeRequest(headers: Record<string, string> = {}): Request {
  return new Request("http://localhost:3000/api/test", { headers });
}

const mockDb = {} as Parameters<typeof auditQueries.insertAuditEvent>[0];

// Minimal table for withTenant tests
const testTable = pgTable("test_table", {
  id: uuid().primaryKey().defaultRandom(),
  operatorId: integer().notNull(),
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Foundation Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // 1. Tenant Context Resolution
  // =========================================================================

  describe("Tenant Context Resolution", () => {
    it("resolves operatorId from x-operator-id header", () => {
      mockGetEnv.mockReturnValue({
        FSP_ENVIRONMENT: "production",
      } as ReturnType<typeof getEnv>);

      const ctx = getTenantFromRequest(
        makeRequest({ "x-operator-id": "42", "x-user-id": "user-abc" })
      );

      expect(ctx.operatorId).toBe(42);
      expect(ctx.userId).toBe("user-abc");
    });
  });

  // =========================================================================
  // 2. Tenant Context Rejection
  // =========================================================================

  describe("Tenant Context Rejection", () => {
    it("throws TenantResolutionError when header is missing in production", () => {
      mockGetEnv.mockReturnValue({
        FSP_ENVIRONMENT: "production",
      } as ReturnType<typeof getEnv>);

      expect(() => getTenantFromRequest(makeRequest())).toThrow(
        TenantResolutionError
      );
    });

    it("falls back to dev defaults when header is missing in mock mode", () => {
      mockGetEnv.mockReturnValue({
        FSP_ENVIRONMENT: "mock",
      } as ReturnType<typeof getEnv>);

      const ctx = getTenantFromRequest(makeRequest());
      expect(ctx.operatorId).toBe(1); // DEV_DEFAULT_OPERATOR_ID
    });
  });

  // =========================================================================
  // 3. FSP Mock Client — Resource Fetching
  // =========================================================================

  describe("FSP Mock Client — Resource Fetching", () => {
    it("returns typed arrays for locations, aircraft, and instructors", async () => {
      const client = new MockFspClient();

      const locations = await client.getLocations(42);
      const aircraft = await client.getAircraft(42);
      const instructors = await client.getInstructors(42);

      expect(Array.isArray(locations)).toBe(true);
      expect(locations.length).toBeGreaterThan(0);
      expect(locations[0]).toHaveProperty("id");
      expect(locations[0]).toHaveProperty("name");

      expect(Array.isArray(aircraft)).toBe(true);
      expect(aircraft.length).toBeGreaterThan(0);
      expect(aircraft[0]).toHaveProperty("id");

      expect(Array.isArray(instructors)).toBe(true);
      expect(instructors.length).toBeGreaterThan(0);
      expect(instructors[0]).toHaveProperty("id");
    });
  });

  // =========================================================================
  // 4. FSP Mock Client — Find-a-Time
  // =========================================================================

  describe("FSP Mock Client — Find-a-Time", () => {
    it("returns slot options with start/end times", async () => {
      const client = new MockFspClient();

      const slots = await client.findATime(42, {
        activityTypeId: "at-1",
        instructorIds: ["inst-aaa-1111"],
        aircraftIds: ["ac-1"],
        startDate: "2026-03-16",
        endDate: "2026-03-20",
        duration: 120,
      });

      expect(slots.length).toBeGreaterThan(0);
      for (const slot of slots) {
        expect(slot.startTime).toBeInstanceOf(Date);
        expect(slot.endTime).toBeInstanceOf(Date);
        expect(slot.endTime.getTime()).toBeGreaterThan(
          slot.startTime.getTime()
        );
        expect(slot).toHaveProperty("instructorId");
        expect(slot).toHaveProperty("aircraftId");
        expect(typeof slot.score).toBe("number");
      }
    });
  });

  // =========================================================================
  // 5. FSP Mock Client — Stateful Behavior
  // =========================================================================

  describe("FSP Mock Client — Stateful Behavior", () => {
    it("removing a reservation decreases the list count", async () => {
      const client = new MockFspClient();
      const params = { start: "2026-03-16", end: "2026-03-18" };

      const before = await client.listReservations(42, params);
      const beforeCount = before.length;
      expect(beforeCount).toBeGreaterThan(0);

      const removed = client.removeReservation("res-001");
      expect(removed).toBe(true);

      const after = await client.listReservations(42, params);
      expect(after.length).toBe(beforeCount - 1);
      expect(after.find((r) => r.reservationId === "res-001")).toBeUndefined();
    });
  });

  // =========================================================================
  // 6. FSP Mock Client — Configurable Scenarios
  // =========================================================================

  describe("FSP Mock Client — Configurable Scenarios", () => {
    it("returns empty slots for no_available_slots scenario then restores on reset", async () => {
      const client = new MockFspClient();
      const findParams = {
        activityTypeId: "at-1",
        startDate: "2026-03-16",
        endDate: "2026-03-20",
        duration: 120,
      };

      // Default — should have slots
      const defaultSlots = await client.findATime(42, findParams);
      expect(defaultSlots.length).toBeGreaterThan(0);

      // Switch to no_available_slots
      client.setScenario("no_available_slots");
      const emptySlots = await client.findATime(42, findParams);
      expect(emptySlots).toEqual([]);

      // Reset — should have slots again
      client.reset();
      const restoredSlots = await client.findATime(42, findParams);
      expect(restoredSlots.length).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // 7. Audit Service — Event Logging
  // =========================================================================

  describe("Audit Service — Event Logging", () => {
    it("logTriggerReceived calls insertAuditEvent with correct event type and payload", async () => {
      const service = new AuditService(mockDb);

      await service.logTriggerReceived(42, "trig-1", "cancellation");

      expect(auditQueries.insertAuditEvent).toHaveBeenCalledWith(mockDb, {
        operatorId: 42,
        eventType: AUDIT_EVENT_TYPES.TRIGGER_RECEIVED,
        entityId: "trig-1",
        entityType: "trigger",
        payload: { triggerType: "cancellation" },
      });
    });

    it("logProposalGenerated calls insertAuditEvent with correct event type and payload", async () => {
      const service = new AuditService(mockDb);

      await service.logProposalGenerated(42, "prop-1", "reschedule");

      expect(auditQueries.insertAuditEvent).toHaveBeenCalledWith(mockDb, {
        operatorId: 42,
        eventType: AUDIT_EVENT_TYPES.PROPOSAL_GENERATED,
        entityId: "prop-1",
        entityType: "proposal",
        payload: { workflowType: "reschedule" },
      });
    });
  });

  // =========================================================================
  // 8. Operator Settings — Defaults
  // =========================================================================

  describe("Operator Settings — Defaults", () => {
    it("has all expected fields with correct default values", () => {
      expect(DEFAULT_OPERATOR_SETTINGS.searchWindowDays).toBe(7);
      expect(DEFAULT_OPERATOR_SETTINGS.topNAlternatives).toBe(5);
      expect(DEFAULT_OPERATOR_SETTINGS.daylightOnly).toBe(true);
      expect(DEFAULT_OPERATOR_SETTINGS.preferSameInstructor).toBe(true);
      expect(DEFAULT_OPERATOR_SETTINGS.preferSameAircraft).toBe(false);
    });

    it("has enabled workflows and communication preferences", () => {
      expect(DEFAULT_OPERATOR_SETTINGS.enabledWorkflows).toEqual({
        reschedule: true,
        discovery_flight: true,
        next_lesson: true,
        waitlist: true,
      });

      expect(DEFAULT_OPERATOR_SETTINGS.communicationPreferences).toEqual({
        email: true,
        sms: false,
      });
    });

    it("has weight fields", () => {
      expect(typeof DEFAULT_OPERATOR_SETTINGS.timeSinceLastFlightWeight).toBe(
        "number"
      );
      expect(typeof DEFAULT_OPERATOR_SETTINGS.timeUntilNextFlightWeight).toBe(
        "number"
      );
      expect(typeof DEFAULT_OPERATOR_SETTINGS.totalFlightHoursWeight).toBe(
        "number"
      );
      expect(
        typeof DEFAULT_OPERATOR_SETTINGS.preferSameInstructorWeight
      ).toBe("number");
      expect(typeof DEFAULT_OPERATOR_SETTINGS.preferSameAircraftWeight).toBe(
        "number"
      );
    });
  });

  // =========================================================================
  // 9. Tenant Isolation Concept
  // =========================================================================

  describe("Tenant Isolation Concept", () => {
    it("withTenant produces distinct SQL conditions for different operators", () => {
      const cond1 = withTenant(testTable, 1);
      const cond2 = withTenant(testTable, 2);

      // Both should be defined SQL objects
      expect(cond1).toBeDefined();
      expect(cond2).toBeDefined();

      // They should not be referentially equal (different operator IDs)
      expect(cond1).not.toBe(cond2);
    });

    it("withTenantAnd combines tenant scope with extra conditions", () => {
      const extra = sql`${testTable.id} = 'abc'`;
      const combined = withTenantAnd(testTable, 1, extra);
      expect(combined).toBeDefined();
    });
  });

  // =========================================================================
  // 10. End-to-End Foundation Flow
  // =========================================================================

  describe("End-to-End Foundation Flow", () => {
    it("resolves tenant, fetches FSP data, and logs an audit event without error", async () => {
      // Step 1: Resolve tenant
      mockGetEnv.mockReturnValue({
        FSP_ENVIRONMENT: "mock",
      } as ReturnType<typeof getEnv>);

      const tenant = getTenantFromRequest(
        makeRequest({ "x-operator-id": "42" })
      );
      expect(tenant.operatorId).toBe(42);

      // Step 2: Create FSP client and fetch resources
      const fspClient = new MockFspClient();

      const locations = await fspClient.getLocations(tenant.operatorId);
      expect(locations.length).toBeGreaterThan(0);

      // Step 3: Fetch schedule
      const schedule = await fspClient.getSchedule(tenant.operatorId, {
        start: "2026-03-16",
        end: "2026-03-17",
        locationIds: [1],
      });
      expect(schedule).toBeDefined();

      // Step 4: Log audit event
      const auditService = new AuditService(mockDb);
      await auditService.logTriggerReceived(
        tenant.operatorId,
        "trig-e2e-1",
        "schedule_change"
      );

      expect(auditQueries.insertAuditEvent).toHaveBeenCalledWith(mockDb, {
        operatorId: 42,
        eventType: "trigger_received",
        entityId: "trig-e2e-1",
        entityType: "trigger",
        payload: { triggerType: "schedule_change" },
      });
    });
  });
});
