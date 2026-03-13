// ---------------------------------------------------------------------------
// FSP API Response Types
// Typed from the Flight Schedule Pro API appendix.
// ---------------------------------------------------------------------------

// ---- Auth -----------------------------------------------------------------

export interface FspAuthResponse {
  token: string;
  user: {
    email: string;
    firstName: string;
    lastName: string;
    role: string;
  };
}

export interface FspMfaResponse {
  mfaRequired: boolean;
  mfaToken: string;
}

// ---- Resources ------------------------------------------------------------

export interface FspOperator {
  id: number;
  name: string;
  isActive: boolean;
  isPending: boolean;
}

export interface FspLocation {
  id: string;
  name: string;
  /** ICAO code */
  code: string;
  timeZone: string;
  isActive: boolean;
}

export interface FspAircraft {
  id: string;
  registration: string;
  make: string;
  model: string;
  makeModel: string;
  isActive: boolean;
  isSimulator: boolean;
}

export interface FspInstructor {
  /** GUID */
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  instructorType: string;
  isActive: boolean;
}

/**
 * displayType values:
 *   0 = Rental / Instruction
 *   1 = Maintenance
 *   2 = Class
 *   3 = Meeting
 */
export interface FspActivityType {
  id: string;
  name: string;
  displayType: number;
  isActive: boolean;
}

export interface FspSchedulingGroup {
  schedulingGroupId: string;
  aircraftIds: string[];
  reserveAircraft: number;
  slots: number;
}

export interface FspUser {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  role: string;
  isActive: boolean;
  imageUrl: string;
}

// ---- Availability ---------------------------------------------------------

export interface FspWeeklyAvailability {
  /** 0 = Sunday .. 6 = Saturday */
  dayOfWeek: number;
  startAtTimeUtc: string;
  endAtTimeUtc: string;
}

export interface FspAvailabilityOverride {
  date: string;
  startTime: string;
  endTime: string;
  isUnavailable: boolean;
}

export interface FspAvailability {
  userGuidId: string;
  availabilities: FspWeeklyAvailability[];
  availabilityOverrides: FspAvailabilityOverride[];
}

// ---- Schedule -------------------------------------------------------------

export interface FspScheduleEvent {
  Start: string;
  End: string;
  Title: string;
  CustomerName: string;
  InstructorName: string;
  AircraftName: string;
}

export interface FspUnavailability {
  ResourceId: string;
  StartDate: string;
  EndDate: string;
  Name: string;
}

export interface FspScheduleResponse {
  results: {
    events: FspScheduleEvent[];
    resources: unknown[];
    unavailability: FspUnavailability[];
  };
}

// ---- Schedulable Events ---------------------------------------------------

/**
 * flightType:  0 = Dual, 1 = Solo
 * routeType:   0 = Local, 1 = CrossCountry
 * timeOfDay:   0 = Anytime, 1 = Day, 2 = Night
 */
export interface FspSchedulableEvent {
  eventId: string;
  enrollmentId: string;
  studentId: string;
  studentFirstName: string;
  studentLastName: string;
  courseId: string;
  courseName: string;
  lessonId: string;
  lessonName: string;
  lessonOrder: number;
  flightType: number;
  routeType: number;
  timeOfDay: number;
  durationTotal: number;
  aircraftDurationTotal: number;
  instructorDurationPre: number;
  instructorDurationPost: number;
  instructorDurationTotal: number;
  instructorRequired: boolean;
  instructorIds: string[];
  aircraftIds: string[];
  schedulingGroupIds: string[];
  meetingRoomIds: string[];
  isStageCheck: boolean;
  reservationTypeId: string;
  activityTypeId: string;
}

// ---- Reservations ---------------------------------------------------------

export interface FspReservationCreate {
  operatorId: number;
  locationId: number;
  aircraftId: string;
  activityTypeId: string;
  pilotId: string;
  instructorId?: string;
  /** Local time string (no timezone suffix) */
  start: string;
  /** Local time string (no timezone suffix) */
  end: string;
  description?: string;
  enrollmentId?: string;
  lessonId?: string;
}

export interface FspReservationError {
  message: string;
  field: string;
}

export interface FspReservationResponse {
  id?: string;
  errors: FspReservationError[];
}

export interface FspReservationListItem {
  reservationId: string;
  reservationNumber: number;
  resource: string;
  start: string;
  end: string;
  pilotFirstName: string;
  pilotLastName: string;
  pilotId: string;
  status: number;
}

// ---- AutoSchedule ---------------------------------------------------------

export interface FspAutoScheduleConfig {
  operatorId: number;
  locationId: number;
  startDate: string;
  endDate: string;
  timeZoneOffset: number;
}

export interface FspAutoScheduleEvent {
  eventId: string;
  studentId: string;
  instructorId?: string;
  aircraftId?: string;
  startUtc: string;
  endUtc: string;
  lessonId: string;
}

export interface FspAutoSchedulePayload {
  config: FspAutoScheduleConfig;
  events: FspAutoScheduleEvent[];
}

/** UTC times — must convert using timeZoneOffset before reservation create. */
export interface FspAutoScheduleResult {
  scheduledEvents: FspAutoScheduleEvent[];
  unscheduledEventIds: string[];
  conflicts: string[];
}

// ---- Other ----------------------------------------------------------------

/** Civil twilight / sunrise-sunset window */
export interface FspCivilTwilight {
  startDate: string;
  endDate: string;
}

export interface FspEnrollment {
  enrollmentId: string;
  studentId: string;
  courseId: string;
  courseName: string;
  startDate: string;
  status: string;
}

export interface FspEnrollmentProgress {
  enrollmentId: string;
  completedLessons: number;
  totalLessons: number;
  completedFlightHours: number;
  requiredFlightHours: number;
}
