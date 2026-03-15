// ---------------------------------------------------------------------------
// FSP Client Interface
// Defines the contract for all FSP API interactions.
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
export type { FspReservationCreate } from "@/lib/types/fsp";
import type { SlotOption } from "@/lib/types/workflow";

// ---- Batch Reservation Types -----------------------------------------------

export interface BatchReservationResponse {
  batchId: string;
  status: string;
}

export interface BatchStatusResponse {
  batchId: string;
  status: "pending" | "processing" | "completed" | "failed";
  results: Array<{ reservationId?: number; error?: string }>;
}

// ---- Params ---------------------------------------------------------------

export interface FindATimeParams {
  activityTypeId: string;
  instructorIds?: string[];
  aircraftIds?: string[];
  schedulingGroupIds?: string[];
  customerId?: string;
  startDate: string;
  endDate: string;
  /** Duration in minutes. */
  duration: number;
}

export interface ScheduleQueryParams {
  start: string;
  end: string;
  locationIds: number[];
}

export interface SchedulableEventsParams {
  startDate: string;
  endDate: string;
  locationId: number;
}

export interface ReservationListParams {
  start: string;
  end: string;
  locationIds?: number[];
}

// ---- Client Interface -----------------------------------------------------

export interface IFspClient {
  // Auth
  authenticate(email: string, password: string): Promise<FspAuthResponse>;
  refreshSession(): Promise<FspAuthResponse>;

  // Resources
  getLocations(operatorId: number): Promise<FspLocation[]>;
  getAircraft(operatorId: number): Promise<FspAircraft[]>;
  getInstructors(operatorId: number): Promise<FspInstructor[]>;
  getActivityTypes(operatorId: number): Promise<FspActivityType[]>;
  getSchedulingGroups(operatorId: number): Promise<FspSchedulingGroup[]>;
  getUsers(operatorId: number): Promise<FspUser[]>;

  // Availability
  getAvailability(
    operatorId: number,
    userIds: string[],
    startDate: string,
    endDate: string,
  ): Promise<FspAvailability[]>;

  // Schedule
  getSchedule(
    operatorId: number,
    params: ScheduleQueryParams,
  ): Promise<FspScheduleResponse>;

  // Schedulable Events
  getSchedulableEvents(
    operatorId: number,
    params: SchedulableEventsParams,
  ): Promise<FspSchedulableEvent[]>;

  // Scheduling Tools
  findATime(
    operatorId: number,
    params: FindATimeParams,
  ): Promise<SlotOption[]>;
  autoSchedule(
    operatorId: number,
    payload: FspAutoSchedulePayload,
  ): Promise<FspAutoScheduleResult>;

  // Reservations
  validateReservation(
    operatorId: number,
    reservation: FspReservationCreate,
  ): Promise<FspReservationResponse>;
  createReservation(
    operatorId: number,
    reservation: FspReservationCreate,
  ): Promise<FspReservationResponse>;
  getReservation(
    operatorId: number,
    reservationId: string,
  ): Promise<FspReservationListItem>;
  listReservations(
    operatorId: number,
    params: ReservationListParams,
  ): Promise<FspReservationListItem[]>;

  // Batch Reservations
  batchCreateReservations(
    operatorId: number,
    reservations: FspReservationCreate[],
  ): Promise<BatchReservationResponse>;
  getBatchStatus(
    operatorId: number,
    batchId: string,
  ): Promise<BatchStatusResponse>;

  // Training
  getEnrollments(
    operatorId: number,
    studentId: string,
  ): Promise<FspEnrollment[]>;
  getEnrollmentProgress(
    operatorId: number,
    enrollmentId: string,
  ): Promise<FspEnrollmentProgress>;

  // Environment
  getCivilTwilight(
    operatorId: number,
    locationId: string,
  ): Promise<FspCivilTwilight>;
}
