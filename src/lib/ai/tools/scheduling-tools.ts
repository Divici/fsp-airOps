// ---------------------------------------------------------------------------
// Scheduling Tools — OpenAI function-calling tool definitions + implementations
// ---------------------------------------------------------------------------

import type { ChatCompletionFunctionTool } from "openai/resources/chat/completions";
import type { IFspClient } from "@/lib/fsp-client";
import { FreshnessChecker } from "@/lib/engine/execution/freshness-check";
import type { AutoApprovalContext } from "../types";

// ---------------------------------------------------------------------------
// Tool Definitions (OpenAI function calling format)
// ---------------------------------------------------------------------------

export const SCHEDULING_TOOLS: ChatCompletionFunctionTool[] = [
  {
    type: "function",
    function: {
      name: "checkSlotAvailability",
      description:
        "Check if a proposed time slot is still available (no conflicts with other reservations)",
      parameters: {
        type: "object",
        properties: {
          startTime: { type: "string", description: "ISO datetime" },
          endTime: { type: "string", description: "ISO datetime" },
          instructorId: {
            type: "string",
            description: "Instructor ID (optional)",
          },
          aircraftId: {
            type: "string",
            description: "Aircraft ID (optional)",
          },
          locationId: { type: "number", description: "Location ID" },
        },
        required: ["startTime", "endTime", "locationId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getStudentHistory",
      description:
        "Get recent flight history for a student (last 30 days of reservations)",
      parameters: {
        type: "object",
        properties: {
          studentId: { type: "string", description: "Student user ID" },
        },
        required: ["studentId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getStudentProgress",
      description:
        "Get training progress for a student (course completion, checkride proximity)",
      parameters: {
        type: "object",
        properties: {
          studentId: { type: "string", description: "Student user ID" },
        },
        required: ["studentId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getInstructorSchedule",
      description:
        "Get an instructor's schedule for a specific date to check workload",
      parameters: {
        type: "object",
        properties: {
          instructorId: { type: "string", description: "Instructor user ID" },
          date: {
            type: "string",
            description: "ISO date (YYYY-MM-DD) to check",
          },
          locationId: { type: "number", description: "Location ID" },
        },
        required: ["instructorId", "date", "locationId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getWeather",
      description:
        "Get current weather conditions at a location for flight safety assessment",
      parameters: {
        type: "object",
        properties: {
          locationId: { type: "number", description: "Location ID" },
          date: {
            type: "string",
            description: "ISO date to check weather for",
          },
        },
        required: ["locationId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getOriginalContext",
      description:
        "Get the original trigger context that initiated this scheduling workflow",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
];

// ---------------------------------------------------------------------------
// Tool Implementations
// ---------------------------------------------------------------------------

export interface CheckSlotAvailabilityParams {
  startTime: string;
  endTime: string;
  instructorId?: string;
  aircraftId?: string;
  locationId: number;
}

export async function checkSlotAvailability(
  fspClient: IFspClient,
  operatorId: number,
  params: CheckSlotAvailabilityParams,
): Promise<{ available: boolean; reason?: string }> {
  const checker = new FreshnessChecker(fspClient);
  return checker.checkSlotAvailable({
    operatorId,
    startTime: new Date(params.startTime),
    endTime: new Date(params.endTime),
    instructorId: params.instructorId ?? null,
    aircraftId: params.aircraftId ?? null,
    locationId: params.locationId,
  });
}

export interface GetStudentHistoryParams {
  studentId: string;
}

export async function getStudentHistory(
  fspClient: IFspClient,
  operatorId: number,
  params: GetStudentHistoryParams,
): Promise<{
  recentFlightCount: number;
  lastFlightDate: string | null;
  totalReservations: number;
}> {
  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const reservations = await fspClient.listReservations(operatorId, {
    start: thirtyDaysAgo.toISOString(),
    end: now.toISOString(),
  });

  const studentReservations = reservations.filter(
    (r) => r.pilotId === params.studentId,
  );

  const sorted = [...studentReservations].sort(
    (a, b) => new Date(b.start).getTime() - new Date(a.start).getTime(),
  );

  return {
    recentFlightCount: studentReservations.length,
    lastFlightDate: sorted.length > 0 ? sorted[0].start : null,
    totalReservations: studentReservations.length,
  };
}

export interface GetStudentProgressParams {
  studentId: string;
}

export async function getStudentProgress(
  fspClient: IFspClient,
  operatorId: number,
  params: GetStudentProgressParams,
): Promise<{
  courseName: string;
  completedLessons: number;
  totalLessons: number;
  percentComplete: number;
  isNearCheckride: boolean;
} | null> {
  const enrollments = await fspClient.getEnrollments(
    operatorId,
    params.studentId,
  );

  if (enrollments.length === 0) {
    return null;
  }

  // Use the first active enrollment
  const enrollment = enrollments[0];
  const progress = await fspClient.getEnrollmentProgress(
    operatorId,
    enrollment.enrollmentId,
  );

  const percentComplete =
    progress.totalLessons > 0
      ? Math.round((progress.completedLessons / progress.totalLessons) * 100)
      : 0;

  return {
    courseName: enrollment.courseName,
    completedLessons: progress.completedLessons,
    totalLessons: progress.totalLessons,
    percentComplete,
    isNearCheckride: percentComplete >= 80,
  };
}

export interface GetInstructorScheduleParams {
  instructorId: string;
  date: string;
  locationId: number;
}

export async function getInstructorSchedule(
  fspClient: IFspClient,
  operatorId: number,
  params: GetInstructorScheduleParams,
): Promise<{ flightsToday: number; isHeavyDay: boolean }> {
  const dateStart = `${params.date}T00:00:00Z`;
  const dateEnd = `${params.date}T23:59:59Z`;

  const schedule = await fspClient.getSchedule(operatorId, {
    start: dateStart,
    end: dateEnd,
    locationIds: [params.locationId],
  });

  const instructorEvents = schedule.results.events.filter(
    (e) => e.InstructorName && e.InstructorName.includes(params.instructorId),
  );

  return {
    flightsToday: instructorEvents.length,
    isHeavyDay: instructorEvents.length >= 5,
  };
}

export interface GetWeatherParams {
  locationId: number;
  date?: string;
}

export function getWeather(
  _params: GetWeatherParams, // eslint-disable-line @typescript-eslint/no-unused-vars
): {
  conditions: string;
  visibility: string;
  ceiling: string;
  windSpeed: number;
  safeForFlight: boolean;
} {
  // Mock VFR data — real FSP API has METAR/TAF endpoints but we use mock for now
  return {
    conditions: "VFR",
    visibility: "10sm",
    ceiling: "clear",
    windSpeed: 8,
    safeForFlight: true,
  };
}

export function getOriginalContext(
  context: AutoApprovalContext,
): { triggerType: string; context: Record<string, unknown> | null } {
  return {
    triggerType: context.trigger.type,
    context: context.trigger.context,
  };
}
