// ---------------------------------------------------------------------------
// Real FSP Client
// Implements all IFspClient methods with actual HTTP calls to the FSP API.
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

export class RealFspClient implements IFspClient {
  private env: Env;
  private token: string | null = null;

  constructor(env: Env) {
    this.env = env;
  }

  // ---------------------------------------------------------------------------
  // Shared fetch helper
  // ---------------------------------------------------------------------------

  private async fspFetch<T>(
    baseUrl: string,
    path: string,
    init?: RequestInit,
  ): Promise<T> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "x-subscription-key": this.env.FSP_SUBSCRIPTION_KEY!,
      ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
      ...((init?.headers as Record<string, string>) ?? {}),
    };

    const res = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`FSP API error ${res.status}: ${path} - ${body}`);
    }

    return res.json() as Promise<T>;
  }

  // ---------------------------------------------------------------------------
  // Auth
  // ---------------------------------------------------------------------------

  async authenticate(
    email: string,
    password: string,
  ): Promise<FspAuthResponse> {
    const response = await this.fspFetch<FspAuthResponse>(
      this.env.FSP_API_BASE_URL!,
      "/common/v1.0/sessions/credentials",
      {
        method: "POST",
        body: JSON.stringify({ email, password }),
      },
    );
    this.token = response.token;
    return response;
  }

  async refreshSession(): Promise<FspAuthResponse> {
    const response = await this.fspFetch<FspAuthResponse>(
      this.env.FSP_API_BASE_URL!,
      "/common/v1.0/sessions/refresh",
      { method: "POST" },
    );
    this.token = response.token;
    return response;
  }

  // ---------------------------------------------------------------------------
  // Resources
  // ---------------------------------------------------------------------------

  async getLocations(operatorId: number): Promise<FspLocation[]> {
    return this.fspFetch<FspLocation[]>(
      this.env.FSP_CORE_BASE_URL!,
      `/common/v1.0/operators/${operatorId}/locations`,
    );
  }

  async getAircraft(operatorId: number): Promise<FspAircraft[]> {
    return this.fspFetch<FspAircraft[]>(
      this.env.FSP_CORE_BASE_URL!,
      `/core/v1.0/operators/${operatorId}/aircraft`,
    );
  }

  async getInstructors(operatorId: number): Promise<FspInstructor[]> {
    return this.fspFetch<FspInstructor[]>(
      this.env.FSP_CORE_BASE_URL!,
      `/core/v1.0/operators/${operatorId}/instructors`,
    );
  }

  async getActivityTypes(operatorId: number): Promise<FspActivityType[]> {
    return this.fspFetch<FspActivityType[]>(
      this.env.FSP_API_BASE_URL!,
      `/api/v1/operator/${operatorId}/activitytypes`,
    );
  }

  async getSchedulingGroups(
    operatorId: number,
  ): Promise<FspSchedulingGroup[]> {
    return this.fspFetch<FspSchedulingGroup[]>(
      this.env.FSP_CORE_BASE_URL!,
      `/common/v1.0/operators/${operatorId}/schedulinggroups`,
    );
  }

  async getUsers(operatorId: number): Promise<FspUser[]> {
    return this.fspFetch<FspUser[]>(
      this.env.FSP_CORE_BASE_URL!,
      `/core/v1.0/operators/${operatorId}/users?limit=1000`,
    );
  }

  // ---------------------------------------------------------------------------
  // Availability
  // ---------------------------------------------------------------------------

  async getAvailability(
    operatorId: number,
    userIds: string[],
    startDate: string,
    endDate: string,
  ): Promise<FspAvailability[]> {
    return this.fspFetch<FspAvailability[]>(
      this.env.FSP_CORE_BASE_URL!,
      `/schedulinghub/v1.0/operators/${operatorId}/users/availabilityAndOverrides`,
      {
        method: "POST",
        body: JSON.stringify({
          userGuidIds: userIds,
          startAtUtc: startDate,
          endAtUtc: endDate,
        }),
      },
    );
  }

  // ---------------------------------------------------------------------------
  // Schedule
  // ---------------------------------------------------------------------------

  async getSchedule(
    _operatorId: number,
    params: ScheduleQueryParams,
  ): Promise<FspScheduleResponse> {
    return this.fspFetch<FspScheduleResponse>(
      this.env.FSP_API_BASE_URL!,
      "/api/v2/schedule",
      {
        method: "POST",
        body: JSON.stringify({
          start: params.start,
          end: params.end,
          locationIds: params.locationIds,
          outputFormat: "bryntum",
          pageSize: 500,
        }),
      },
    );
  }

  // ---------------------------------------------------------------------------
  // Schedulable Events
  // ---------------------------------------------------------------------------

  async getSchedulableEvents(
    operatorId: number,
    params: SchedulableEventsParams,
  ): Promise<FspSchedulableEvent[]> {
    return this.fspFetch<FspSchedulableEvent[]>(
      this.env.FSP_CURRICULUM_BASE_URL!,
      `/traininghub/v1.0/operators/${operatorId}/schedulableEvents`,
      {
        method: "POST",
        body: JSON.stringify({
          startDate: params.startDate,
          endDate: params.endDate,
          locationId: params.locationId,
          listType: 1,
          filters: [],
          priorities: [],
          useAllInstructors: false,
        }),
      },
    );
  }

  // ---------------------------------------------------------------------------
  // Scheduling Tools
  // ---------------------------------------------------------------------------

  async findATime(
    operatorId: number,
    params: FindATimeParams,
  ): Promise<SlotOption[]> {
    // FSP returns availability slots; map to SlotOption[]
    interface FspSlotResponse {
      startTime?: string;
      endTime?: string;
      instructorId?: string;
      aircraftId?: string;
      locationId?: number;
      score?: number;
    }

    const rawSlots = await this.fspFetch<FspSlotResponse[]>(
      this.env.FSP_CORE_BASE_URL!,
      `/schedulinghub/v1.0/operators/${operatorId}/scheduleMatch/availability`,
      {
        method: "POST",
        body: JSON.stringify(params),
      },
    );

    return rawSlots.map((slot) => ({
      startTime: new Date(slot.startTime ?? ""),
      endTime: new Date(slot.endTime ?? ""),
      instructorId: slot.instructorId,
      aircraftId: slot.aircraftId,
      locationId: slot.locationId ?? 0,
      score: slot.score ?? 0,
    }));
  }

  async autoSchedule(
    operatorId: number,
    payload: FspAutoSchedulePayload,
  ): Promise<FspAutoScheduleResult> {
    return this.fspFetch<FspAutoScheduleResult>(
      this.env.FSP_CORE_BASE_URL!,
      `/schedulinghub/v1.0/operators/${operatorId}/autoSchedule`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );
  }

  // ---------------------------------------------------------------------------
  // Reservations
  // ---------------------------------------------------------------------------

  async validateReservation(
    _operatorId: number,
    reservation: FspReservationCreate,
  ): Promise<FspReservationResponse> {
    return this.fspFetch<FspReservationResponse>(
      this.env.FSP_API_BASE_URL!,
      "/api/V2/Reservation",
      {
        method: "POST",
        body: JSON.stringify({ ...reservation, validateOnly: true }),
      },
    );
  }

  async createReservation(
    _operatorId: number,
    reservation: FspReservationCreate,
  ): Promise<FspReservationResponse> {
    return this.fspFetch<FspReservationResponse>(
      this.env.FSP_API_BASE_URL!,
      "/api/V2/Reservation",
      {
        method: "POST",
        body: JSON.stringify({ ...reservation, validateOnly: false }),
      },
    );
  }

  async getReservation(
    operatorId: number,
    reservationId: string,
  ): Promise<FspReservationListItem> {
    return this.fspFetch<FspReservationListItem>(
      this.env.FSP_API_BASE_URL!,
      `/api/V2/Reservation/${reservationId}?operatorId=${operatorId}`,
    );
  }

  async listReservations(
    operatorId: number,
    params: ReservationListParams,
  ): Promise<FspReservationListItem[]> {
    interface FspPaginatedResponse {
      total: number;
      pageIndex: number;
      pageSize: number;
      results: FspReservationListItem[];
    }

    const response = await this.fspFetch<FspPaginatedResponse>(
      this.env.FSP_API_BASE_URL!,
      `/api/V1/operator/${operatorId}/operatorReservations/list`,
      {
        method: "POST",
        body: JSON.stringify({
          dateRangeType: 3,
          startRange: params.start,
          endRange: params.end,
          locationIds: params.locationIds ?? [],
          pageSize: 500,
          pageIndex: 0,
        }),
      },
    );

    return response.results;
  }

  // ---------------------------------------------------------------------------
  // Training
  // ---------------------------------------------------------------------------

  async getEnrollments(
    operatorId: number,
    studentId: string,
  ): Promise<FspEnrollment[]> {
    return this.fspFetch<FspEnrollment[]>(
      this.env.FSP_CURRICULUM_BASE_URL!,
      `/traininghub/v1.0/operators/${operatorId}/enrollments/list/${studentId}`,
    );
  }

  async getEnrollmentProgress(
    operatorId: number,
    enrollmentId: string,
  ): Promise<FspEnrollmentProgress> {
    return this.fspFetch<FspEnrollmentProgress>(
      this.env.FSP_CURRICULUM_BASE_URL!,
      `/traininghub/v1.0/operators/${operatorId}/enrollments/${enrollmentId}/progress`,
    );
  }

  // ---------------------------------------------------------------------------
  // Environment
  // ---------------------------------------------------------------------------

  async getCivilTwilight(
    operatorId: number,
    locationId: string,
  ): Promise<FspCivilTwilight> {
    return this.fspFetch<FspCivilTwilight>(
      this.env.FSP_CORE_BASE_URL!,
      `/common/v1.0/operators/${operatorId}/locations/${locationId}/civilTwilight`,
    );
  }
}
