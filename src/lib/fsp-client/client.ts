/* eslint-disable @typescript-eslint/no-unused-vars */
// ---------------------------------------------------------------------------
// Real FSP Client (Stub)
// Placeholder for actual FSP API HTTP calls. Each method documents the
// endpoint it will call once FSP dev credentials are available.
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
import type { Env } from "@/config/env";
import type {
  IFspClient,
  FindATimeParams,
  ScheduleQueryParams,
  SchedulableEventsParams,
  ReservationListParams,
} from "./types";

function notImplemented(method: string): never {
  throw new Error(
    `RealFspClient.${method} is not implemented. Awaiting FSP dev credentials.`,
  );
}

export class RealFspClient implements IFspClient {
  private baseUrl: string;
  private coreBaseUrl: string;
  private curriculumBaseUrl: string;
  private subscriptionKey: string;
  private token: string | null = null;

  constructor(env: Env) {
    this.baseUrl = env.FSP_API_BASE_URL!;
    this.coreBaseUrl = env.FSP_CORE_BASE_URL!;
    this.curriculumBaseUrl = env.FSP_CURRICULUM_BASE_URL!;
    this.subscriptionKey = env.FSP_SUBSCRIPTION_KEY!;
  }

  // -- Auth -- POST /api/auth/login
  async authenticate(
    _email: string,
    _password: string,
  ): Promise<FspAuthResponse> {
    notImplemented("authenticate");
  }

  // -- Auth -- POST /api/auth/refresh
  async refreshSession(): Promise<FspAuthResponse> {
    notImplemented("refreshSession");
  }

  // -- GET /api/operators/{id}/locations
  async getLocations(_operatorId: number): Promise<FspLocation[]> {
    notImplemented("getLocations");
  }

  // -- GET /api/operators/{id}/aircraft
  async getAircraft(_operatorId: number): Promise<FspAircraft[]> {
    notImplemented("getAircraft");
  }

  // -- GET /api/operators/{id}/instructors
  async getInstructors(_operatorId: number): Promise<FspInstructor[]> {
    notImplemented("getInstructors");
  }

  // -- GET /api/operators/{id}/activityTypes
  async getActivityTypes(_operatorId: number): Promise<FspActivityType[]> {
    notImplemented("getActivityTypes");
  }

  // -- GET /api/operators/{id}/schedulingGroups
  async getSchedulingGroups(
    _operatorId: number,
  ): Promise<FspSchedulingGroup[]> {
    notImplemented("getSchedulingGroups");
  }

  // -- GET /api/operators/{id}/users
  async getUsers(_operatorId: number): Promise<FspUser[]> {
    notImplemented("getUsers");
  }

  // -- POST /api/operators/{id}/availability
  async getAvailability(
    _operatorId: number,
    _userIds: string[],
    _startDate: string,
    _endDate: string,
  ): Promise<FspAvailability[]> {
    notImplemented("getAvailability");
  }

  // -- POST /api/operators/{id}/schedule
  async getSchedule(
    _operatorId: number,
    _params: ScheduleQueryParams,
  ): Promise<FspScheduleResponse> {
    notImplemented("getSchedule");
  }

  // -- GET /api/operators/{id}/schedulableEvents
  async getSchedulableEvents(
    _operatorId: number,
    _params: SchedulableEventsParams,
  ): Promise<FspSchedulableEvent[]> {
    notImplemented("getSchedulableEvents");
  }

  // -- POST /api/operators/{id}/findATime
  async findATime(
    _operatorId: number,
    _params: FindATimeParams,
  ): Promise<SlotOption[]> {
    notImplemented("findATime");
  }

  // -- POST /api/operators/{id}/autoSchedule
  async autoSchedule(
    _operatorId: number,
    _payload: FspAutoSchedulePayload,
  ): Promise<FspAutoScheduleResult> {
    notImplemented("autoSchedule");
  }

  // -- POST /api/operators/{id}/reservations/validate
  async validateReservation(
    _operatorId: number,
    _reservation: FspReservationCreate,
  ): Promise<FspReservationResponse> {
    notImplemented("validateReservation");
  }

  // -- POST /api/operators/{id}/reservations
  async createReservation(
    _operatorId: number,
    _reservation: FspReservationCreate,
  ): Promise<FspReservationResponse> {
    notImplemented("createReservation");
  }

  // -- GET /api/operators/{id}/reservations/{reservationId}
  async getReservation(
    _operatorId: number,
    _reservationId: string,
  ): Promise<FspReservationListItem> {
    notImplemented("getReservation");
  }

  // -- GET /api/operators/{id}/reservations
  async listReservations(
    _operatorId: number,
    _params: ReservationListParams,
  ): Promise<FspReservationListItem[]> {
    notImplemented("listReservations");
  }

  // -- GET /api/operators/{id}/enrollments?studentId=
  async getEnrollments(
    _operatorId: number,
    _studentId: string,
  ): Promise<FspEnrollment[]> {
    notImplemented("getEnrollments");
  }

  // -- GET /api/operators/{id}/enrollments/{enrollmentId}/progress
  async getEnrollmentProgress(
    _operatorId: number,
    _enrollmentId: string,
  ): Promise<FspEnrollmentProgress> {
    notImplemented("getEnrollmentProgress");
  }

  // -- GET /api/operators/{id}/civilTwilight/{locationId}
  async getCivilTwilight(
    _operatorId: number,
    _locationId: string,
  ): Promise<FspCivilTwilight> {
    notImplemented("getCivilTwilight");
  }
}
