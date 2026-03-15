// @vitest-environment node
import { describe, it, expect, beforeEach } from "vitest";
import { MockFspClient } from "../mock";

describe("MockFspClient", () => {
  let client: MockFspClient;
  const operatorId = 1;

  beforeEach(() => {
    client = new MockFspClient();
  });

  // ---- Auth ---------------------------------------------------------------

  describe("authenticate", () => {
    it("returns a token and user", async () => {
      const result = await client.authenticate("test@test.com", "password");
      expect(result.token).toBeTruthy();
      expect(result.user.email).toBeTruthy();
      expect(result.user.role).toBeTruthy();
    });
  });

  describe("refreshSession", () => {
    it("returns a valid auth response", async () => {
      const result = await client.refreshSession();
      expect(result.token).toBeTruthy();
    });
  });

  // ---- Resources ----------------------------------------------------------

  describe("getLocations", () => {
    it("returns an array of locations with ICAO codes", async () => {
      const locations = await client.getLocations(operatorId);
      expect(locations.length).toBeGreaterThan(0);
      expect(locations[0]).toHaveProperty("code");
      expect(locations[0]).toHaveProperty("timeZone");
      expect(locations.every((l) => l.isActive)).toBe(true);
    });
  });

  describe("getAircraft", () => {
    it("returns aircraft with registration and make/model", async () => {
      const aircraft = await client.getAircraft(operatorId);
      expect(aircraft.length).toBeGreaterThanOrEqual(4);
      expect(aircraft[0]).toHaveProperty("registration");
      expect(aircraft[0]).toHaveProperty("makeModel");
    });
  });

  describe("getInstructors", () => {
    it("returns instructors with IDs and types", async () => {
      const instructors = await client.getInstructors(operatorId);
      expect(instructors.length).toBeGreaterThanOrEqual(3);
      expect(instructors[0]).toHaveProperty("instructorType");
      expect(instructors[0]).toHaveProperty("fullName");
    });
  });

  describe("getActivityTypes", () => {
    it("returns activity types", async () => {
      const types = await client.getActivityTypes(operatorId);
      expect(types.length).toBeGreaterThanOrEqual(3);
      expect(types.map((t) => t.name)).toContain("Dual Flight");
    });
  });

  describe("getSchedulingGroups", () => {
    it("returns scheduling groups with aircraft IDs", async () => {
      const groups = await client.getSchedulingGroups(operatorId);
      expect(groups.length).toBeGreaterThan(0);
      expect(groups[0]).toHaveProperty("aircraftIds");
      expect(Array.isArray(groups[0].aircraftIds)).toBe(true);
    });
  });

  describe("getUsers", () => {
    it("returns users (students)", async () => {
      const users = await client.getUsers(operatorId);
      expect(users.length).toBeGreaterThanOrEqual(5);
      expect(users[0]).toHaveProperty("email");
      expect(users[0]).toHaveProperty("role");
    });
  });

  // ---- Availability -------------------------------------------------------

  describe("getAvailability", () => {
    it("returns availability for requested user IDs", async () => {
      const result = await client.getAvailability(
        operatorId,
        ["inst-aaa-1111", "inst-bbb-2222"],
        "2026-03-16",
        "2026-03-22",
      );
      expect(result).toHaveLength(2);
      expect(result[0].availabilities.length).toBeGreaterThan(0);
    });

    it("returns empty array for unknown user IDs", async () => {
      const result = await client.getAvailability(
        operatorId,
        ["unknown-id"],
        "2026-03-16",
        "2026-03-22",
      );
      expect(result).toHaveLength(0);
    });
  });

  // ---- Schedule -----------------------------------------------------------

  describe("getSchedule", () => {
    it("returns schedule with events", async () => {
      const schedule = await client.getSchedule(operatorId, {
        start: "2026-03-16",
        end: "2026-03-22",
        locationIds: [1],
      });
      expect(schedule.results.events.length).toBeGreaterThan(0);
      expect(schedule.results.events[0]).toHaveProperty("Start");
      expect(schedule.results.events[0]).toHaveProperty("CustomerName");
    });
  });

  // ---- Schedulable Events -------------------------------------------------

  describe("getSchedulableEvents", () => {
    it("returns pending training events", async () => {
      const events = await client.getSchedulableEvents(operatorId, {
        startDate: "2026-03-16",
        endDate: "2026-03-22",
        locationId: 1,
      });
      expect(events.length).toBeGreaterThan(0);
      expect(events[0]).toHaveProperty("studentId");
      expect(events[0]).toHaveProperty("lessonName");
      expect(events[0]).toHaveProperty("durationTotal");
    });
  });

  // ---- findATime ----------------------------------------------------------

  describe("findATime", () => {
    it("returns slot options with scores", async () => {
      const slots = await client.findATime(operatorId, {
        activityTypeId: "at-1",
        startDate: "2026-03-16",
        endDate: "2026-03-22",
        duration: 120,
      });
      expect(slots.length).toBeGreaterThanOrEqual(3);
      expect(slots[0]).toHaveProperty("startTime");
      expect(slots[0]).toHaveProperty("endTime");
      expect(slots[0]).toHaveProperty("score");
      expect(slots[0].score).toBeGreaterThan(0);
    });

    it("returns empty when scenario is no_available_slots", async () => {
      client.setScenario("no_available_slots");
      const slots = await client.findATime(operatorId, {
        activityTypeId: "at-1",
        startDate: "2026-03-16",
        endDate: "2026-03-22",
        duration: 120,
      });
      expect(slots).toHaveLength(0);
    });

    it("returns empty when scenario is all_slots_taken", async () => {
      client.setScenario("all_slots_taken");
      const slots = await client.findATime(operatorId, {
        activityTypeId: "at-1",
        startDate: "2026-03-16",
        endDate: "2026-03-22",
        duration: 120,
      });
      expect(slots).toHaveLength(0);
    });
  });

  // ---- autoSchedule -------------------------------------------------------

  describe("autoSchedule", () => {
    it("schedules all events by default", async () => {
      const result = await client.autoSchedule(operatorId, {
        config: {
          operatorId: 1,
          locationId: 1,
          startDate: "2026-03-16",
          endDate: "2026-03-22",
          timeZoneOffset: -8,
        },
        events: [
          {
            eventId: "evt-001",
            studentId: "stu-aaa-1111",
            lessonId: "les-ppl-08",
            startUtc: "",
            endUtc: "",
          },
        ],
      });
      expect(result.scheduledEvents).toHaveLength(1);
      expect(result.unscheduledEventIds).toHaveLength(0);
      expect(result.conflicts).toHaveLength(0);
    });

    it("returns all unscheduled when all_slots_taken", async () => {
      client.setScenario("all_slots_taken");
      const result = await client.autoSchedule(operatorId, {
        config: {
          operatorId: 1,
          locationId: 1,
          startDate: "2026-03-16",
          endDate: "2026-03-22",
          timeZoneOffset: -8,
        },
        events: [
          {
            eventId: "evt-001",
            studentId: "stu-aaa-1111",
            lessonId: "les-ppl-08",
            startUtc: "",
            endUtc: "",
          },
        ],
      });
      expect(result.scheduledEvents).toHaveLength(0);
      expect(result.unscheduledEventIds).toContain("evt-001");
      expect(result.conflicts.length).toBeGreaterThan(0);
    });
  });

  // ---- Reservations -------------------------------------------------------

  describe("validateReservation", () => {
    const reservation = {
      operatorId: 1,
      locationId: 1,
      aircraftId: "ac-1",
      activityTypeId: "at-1",
      pilotId: "stu-aaa-1111",
      instructorId: "inst-aaa-1111",
      start: "2026-03-16T08:00:00",
      end: "2026-03-16T10:00:00",
    };

    it("returns no errors by default", async () => {
      const result = await client.validateReservation(operatorId, reservation);
      expect(result.errors).toHaveLength(0);
    });

    it("returns errors when validation_fails scenario", async () => {
      client.setScenario("validation_fails");
      const result = await client.validateReservation(operatorId, reservation);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toHaveProperty("message");
      expect(result.errors[0]).toHaveProperty("field");
    });
  });

  describe("createReservation", () => {
    const reservation = {
      operatorId: 1,
      locationId: 1,
      aircraftId: "ac-1",
      activityTypeId: "at-1",
      pilotId: "stu-aaa-1111",
      start: "2026-03-23T08:00:00",
      end: "2026-03-23T10:00:00",
    };

    it("returns a generated reservation ID", async () => {
      const result = await client.createReservation(operatorId, reservation);
      expect(result.id).toBeTruthy();
      expect(result.errors).toHaveLength(0);
    });

    it("adds reservation to internal state", async () => {
      const before = await client.listReservations(operatorId, {
        start: "2026-03-01",
        end: "2026-03-31",
      });
      const beforeCount = before.length;

      await client.createReservation(operatorId, reservation);

      const after = await client.listReservations(operatorId, {
        start: "2026-03-01",
        end: "2026-03-31",
      });
      expect(after.length).toBe(beforeCount + 1);
    });
  });

  describe("getReservation", () => {
    it("returns a reservation by ID", async () => {
      const reservation = await client.getReservation(operatorId, "res-001");
      expect(reservation.reservationId).toBe("res-001");
      expect(reservation.pilotFirstName).toBeTruthy();
    });

    it("throws for non-existent reservation", async () => {
      await expect(
        client.getReservation(operatorId, "non-existent"),
      ).rejects.toThrow("not found");
    });
  });

  describe("listReservations", () => {
    it("returns all reservations", async () => {
      const reservations = await client.listReservations(operatorId, {
        start: "2026-03-01",
        end: "2026-03-31",
      });
      expect(reservations.length).toBeGreaterThan(0);
    });
  });

  // ---- Stateful behavior: removeReservation -------------------------------

  describe("stateful behavior", () => {
    it("removes a reservation and confirms it is gone", async () => {
      const removed = client.removeReservation("res-001");
      expect(removed).toBe(true);

      await expect(
        client.getReservation(operatorId, "res-001"),
      ).rejects.toThrow("not found");
    });

    it("returns false when removing a non-existent reservation", () => {
      const removed = client.removeReservation("non-existent");
      expect(removed).toBe(false);
    });

    it("resets state to defaults", async () => {
      client.removeReservation("res-001");
      client.setScenario("validation_fails");
      client.reset();

      const reservation = await client.getReservation(operatorId, "res-001");
      expect(reservation.reservationId).toBe("res-001");

      const validation = await client.validateReservation(operatorId, {
        operatorId: 1,
        locationId: 1,
        aircraftId: "ac-1",
        activityTypeId: "at-1",
        pilotId: "stu-aaa-1111",
        start: "2026-03-16T08:00:00",
        end: "2026-03-16T10:00:00",
      });
      expect(validation.errors).toHaveLength(0);
    });
  });

  // ---- Training -----------------------------------------------------------

  describe("getEnrollments", () => {
    it("returns enrollments for a student", async () => {
      const enrollments = await client.getEnrollments(
        operatorId,
        "stu-aaa-1111",
      );
      expect(enrollments.length).toBeGreaterThan(0);
      expect(enrollments[0]).toHaveProperty("courseName");
    });

    it("returns empty array for student with no enrollments", async () => {
      const enrollments = await client.getEnrollments(
        operatorId,
        "unknown-student",
      );
      expect(enrollments).toHaveLength(0);
    });
  });

  describe("getEnrollmentProgress", () => {
    it("returns progress for an enrollment", async () => {
      const progress = await client.getEnrollmentProgress(
        operatorId,
        "enr-001",
      );
      expect(progress.completedLessons).toBeGreaterThan(0);
      expect(progress.totalLessons).toBeGreaterThan(progress.completedLessons);
    });

    it("throws for non-existent enrollment", async () => {
      await expect(
        client.getEnrollmentProgress(operatorId, "non-existent"),
      ).rejects.toThrow("not found");
    });
  });

  // ---- Batch Reservations -------------------------------------------------

  describe("batchCreateReservations", () => {
    it("returns a batchId and completed status", async () => {
      const reservations = [
        {
          operatorId: 1,
          locationId: 1,
          aircraftId: "ac-1",
          activityTypeId: "at-1",
          pilotId: "stu-aaa-1111",
          start: "2026-03-23T08:00:00",
          end: "2026-03-23T10:00:00",
        },
        {
          operatorId: 1,
          locationId: 1,
          aircraftId: "ac-2",
          activityTypeId: "at-1",
          pilotId: "stu-bbb-2222",
          start: "2026-03-23T10:00:00",
          end: "2026-03-23T12:00:00",
        },
      ];

      const result = await client.batchCreateReservations(operatorId, reservations);
      expect(result.batchId).toBeTruthy();
      expect(result.status).toBe("completed");
    });

    it("adds all reservations to internal state", async () => {
      const before = await client.listReservations(operatorId, {
        start: "2026-03-01",
        end: "2026-03-31",
      });
      const beforeCount = before.length;

      await client.batchCreateReservations(operatorId, [
        {
          operatorId: 1,
          locationId: 1,
          aircraftId: "ac-1",
          activityTypeId: "at-1",
          pilotId: "stu-aaa-1111",
          start: "2026-03-23T08:00:00",
          end: "2026-03-23T10:00:00",
        },
        {
          operatorId: 1,
          locationId: 1,
          aircraftId: "ac-2",
          activityTypeId: "at-1",
          pilotId: "stu-bbb-2222",
          start: "2026-03-23T10:00:00",
          end: "2026-03-23T12:00:00",
        },
      ]);

      const after = await client.listReservations(operatorId, {
        start: "2026-03-01",
        end: "2026-03-31",
      });
      expect(after.length).toBe(beforeCount + 2);
    });
  });

  describe("getBatchStatus", () => {
    it("returns completed status for any batchId", async () => {
      const status = await client.getBatchStatus(operatorId, "batch-123");
      expect(status.batchId).toBe("batch-123");
      expect(status.status).toBe("completed");
      expect(Array.isArray(status.results)).toBe(true);
    });
  });

  // ---- Environment --------------------------------------------------------

  describe("getCivilTwilight", () => {
    it("returns sunrise/sunset times", async () => {
      const twilight = await client.getCivilTwilight(operatorId, "loc-1");
      expect(twilight).toHaveProperty("startDate");
      expect(twilight).toHaveProperty("endDate");
    });
  });
});
