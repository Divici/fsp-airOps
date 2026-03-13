/* eslint-disable @typescript-eslint/no-unused-vars */
// ---------------------------------------------------------------------------
// Mock FSP Client
// Stateful, configurable mock implementation of IFspClient for development
// and testing.
// ---------------------------------------------------------------------------

import type {
  FspAuthResponse,
  FspLocation,
  FspAircraft,
  FspInstructor,
  FspActivityType,
  FspSchedulingGroup,
  FspUser,
  FspAvailability,
  FspScheduleResponse,
  FspSchedulableEvent,
  FspAutoSchedulePayload,
  FspAutoScheduleResult,
  FspReservationCreate,
  FspReservationResponse,
  FspReservationListItem,
  FspEnrollment,
  FspEnrollmentProgress,
  FspCivilTwilight,
} from "@/lib/types/fsp";
import type { SlotOption } from "@/lib/types/workflow";
import type {
  IFspClient,
  FindATimeParams,
  ScheduleQueryParams,
  SchedulableEventsParams,
  ReservationListParams,
} from "../types";

import { mockLocations } from "./data/locations";
import { mockAircraft } from "./data/aircraft";
import { mockInstructors } from "./data/instructors";
import { mockStudents } from "./data/students";
import { mockActivityTypes } from "./data/activity-types";
import { mockAvailability } from "./data/availability";
import { mockSchedule } from "./data/schedule";
import { mockSchedulableEvents } from "./data/schedulable-events";
import {
  mockEnrollments,
  mockEnrollmentProgress,
} from "./data/enrollments";
import { mockReservations } from "./data/reservations";

// ---- Scenario Configuration -----------------------------------------------

export type MockScenario =
  | "default"
  | "no_available_slots"
  | "validation_fails"
  | "all_slots_taken";

export interface MockFspClientOptions {
  scenario?: MockScenario;
}

// ---- Mock Client ----------------------------------------------------------

export class MockFspClient implements IFspClient {
  private scenario: MockScenario;
  private reservations: FspReservationListItem[];
  private nextReservationNumber: number;

  constructor(options: MockFspClientOptions = {}) {
    this.scenario = options.scenario ?? "default";
    this.reservations = [...mockReservations];
    this.nextReservationNumber = 20001;
  }

  /** Change the active scenario at runtime (useful in tests). */
  setScenario(scenario: MockScenario): void {
    this.scenario = scenario;
  }

  /** Remove a reservation by ID (simulate cancellation). */
  removeReservation(reservationId: string): boolean {
    const before = this.reservations.length;
    this.reservations = this.reservations.filter(
      (r) => r.reservationId !== reservationId,
    );
    return this.reservations.length < before;
  }

  /** Reset all mutable state back to defaults. */
  reset(): void {
    this.scenario = "default";
    this.reservations = [...mockReservations];
    this.nextReservationNumber = 20001;
  }

  // -- Auth -----------------------------------------------------------------

  async authenticate(
    _email: string,
    _password: string,
  ): Promise<FspAuthResponse> {
    return {
      token: "mock-jwt-token-abc123",
      user: {
        email: "admin@mockflight.school",
        firstName: "Admin",
        lastName: "User",
        role: "Admin",
      },
    };
  }

  async refreshSession(): Promise<FspAuthResponse> {
    return this.authenticate("", "");
  }

  // -- Resources ------------------------------------------------------------

  async getLocations(_operatorId: number): Promise<FspLocation[]> {
    return mockLocations;
  }

  async getAircraft(_operatorId: number): Promise<FspAircraft[]> {
    return mockAircraft;
  }

  async getInstructors(_operatorId: number): Promise<FspInstructor[]> {
    return mockInstructors;
  }

  async getActivityTypes(_operatorId: number): Promise<FspActivityType[]> {
    return mockActivityTypes;
  }

  async getSchedulingGroups(
    _operatorId: number,
  ): Promise<FspSchedulingGroup[]> {
    return [
      {
        schedulingGroupId: "sg-1",
        aircraftIds: ["ac-1", "ac-4"],
        reserveAircraft: 0,
        slots: 2,
      },
      {
        schedulingGroupId: "sg-2",
        aircraftIds: ["ac-2"],
        reserveAircraft: 0,
        slots: 1,
      },
    ];
  }

  async getUsers(_operatorId: number): Promise<FspUser[]> {
    return mockStudents;
  }

  // -- Availability ---------------------------------------------------------

  async getAvailability(
    _operatorId: number,
    userIds: string[],
    _startDate: string,
    _endDate: string,
  ): Promise<FspAvailability[]> {
    return mockAvailability.filter((a) => userIds.includes(a.userGuidId));
  }

  // -- Schedule -------------------------------------------------------------

  async getSchedule(
    _operatorId: number,
    _params: ScheduleQueryParams,
  ): Promise<FspScheduleResponse> {
    return mockSchedule;
  }

  // -- Schedulable Events ---------------------------------------------------

  async getSchedulableEvents(
    _operatorId: number,
    _params: SchedulableEventsParams,
  ): Promise<FspSchedulableEvent[]> {
    return mockSchedulableEvents;
  }

  // -- Scheduling Tools -----------------------------------------------------

  async findATime(
    _operatorId: number,
    params: FindATimeParams,
  ): Promise<SlotOption[]> {
    if (
      this.scenario === "no_available_slots" ||
      this.scenario === "all_slots_taken"
    ) {
      return [];
    }

    const baseDate = new Date(params.startDate + "T09:00:00");
    const slots: SlotOption[] = [];

    for (let i = 0; i < 4; i++) {
      const start = new Date(baseDate);
      start.setDate(start.getDate() + i);
      start.setHours(8 + i * 2);

      const end = new Date(start);
      end.setMinutes(end.getMinutes() + params.duration);

      slots.push({
        startTime: start,
        endTime: end,
        instructorId: params.instructorIds?.[0] ?? "inst-aaa-1111",
        aircraftId: params.aircraftIds?.[0] ?? "ac-1",
        locationId: 1,
        score: 100 - i * 15,
      });
    }

    return slots;
  }

  async autoSchedule(
    _operatorId: number,
    payload: FspAutoSchedulePayload,
  ): Promise<FspAutoScheduleResult> {
    if (this.scenario === "all_slots_taken") {
      return {
        scheduledEvents: [],
        unscheduledEventIds: payload.events.map((e) => e.eventId),
        conflicts: ["All resources are fully booked for the requested period."],
      };
    }

    return {
      scheduledEvents: payload.events.map((evt) => ({
        ...evt,
        startUtc: evt.startUtc || "2026-03-16T16:00:00Z",
        endUtc: evt.endUtc || "2026-03-16T18:00:00Z",
      })),
      unscheduledEventIds: [],
      conflicts: [],
    };
  }

  // -- Reservations ---------------------------------------------------------

  async validateReservation(
    _operatorId: number,
    _reservation: FspReservationCreate,
  ): Promise<FspReservationResponse> {
    if (this.scenario === "validation_fails") {
      return {
        errors: [
          {
            message: "Aircraft N12345 is not available at the requested time.",
            field: "aircraftId",
          },
          {
            message: "Instructor has a scheduling conflict.",
            field: "instructorId",
          },
        ],
      };
    }

    return { id: undefined, errors: [] };
  }

  async createReservation(
    _operatorId: number,
    reservation: FspReservationCreate,
  ): Promise<FspReservationResponse> {
    if (this.scenario === "validation_fails") {
      return {
        errors: [
          {
            message: "Aircraft N12345 is not available at the requested time.",
            field: "aircraftId",
          },
        ],
      };
    }

    const id = `res-gen-${this.nextReservationNumber}`;
    const num = this.nextReservationNumber++;

    this.reservations.push({
      reservationId: id,
      reservationNumber: num,
      resource: reservation.aircraftId,
      start: reservation.start,
      end: reservation.end,
      pilotFirstName: "Mock",
      pilotLastName: "Pilot",
      pilotId: reservation.pilotId,
      status: 1,
    });

    return { id, errors: [] };
  }

  async getReservation(
    _operatorId: number,
    reservationId: string,
  ): Promise<FspReservationListItem> {
    const found = this.reservations.find(
      (r) => r.reservationId === reservationId,
    );
    if (!found) {
      throw new Error(`Reservation ${reservationId} not found`);
    }
    return found;
  }

  async listReservations(
    _operatorId: number,
    _params: ReservationListParams,
  ): Promise<FspReservationListItem[]> {
    return this.reservations;
  }

  // -- Training -------------------------------------------------------------

  async getEnrollments(
    _operatorId: number,
    studentId: string,
  ): Promise<FspEnrollment[]> {
    return mockEnrollments.filter((e) => e.studentId === studentId);
  }

  async getEnrollmentProgress(
    _operatorId: number,
    enrollmentId: string,
  ): Promise<FspEnrollmentProgress> {
    const progress = mockEnrollmentProgress[enrollmentId];
    if (!progress) {
      throw new Error(`Enrollment ${enrollmentId} not found`);
    }
    return progress;
  }

  // -- Environment ----------------------------------------------------------

  async getCivilTwilight(
    _operatorId: number,
    _locationId: string,
  ): Promise<FspCivilTwilight> {
    return {
      startDate: "2026-03-16T06:15:00",
      endDate: "2026-03-16T18:45:00",
    };
  }
}
