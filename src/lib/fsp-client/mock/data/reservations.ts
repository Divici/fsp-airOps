import type { FspReservationListItem } from "@/lib/types/fsp";

/**
 * Pre-existing reservations matching the schedule events.
 */
export const mockReservations: FspReservationListItem[] = [
  {
    reservationId: "res-001",
    reservationNumber: 10001,
    resource: "N12345 - Cessna 172S",
    start: "2026-03-16T08:00:00",
    end: "2026-03-16T10:00:00",
    pilotFirstName: "Alex",
    pilotLastName: "Rivera",
    pilotId: "stu-aaa-1111",
    status: 1,
  },
  {
    reservationId: "res-002",
    reservationNumber: 10002,
    resource: "N12345 - Cessna 172S",
    start: "2026-03-16T10:30:00",
    end: "2026-03-16T12:30:00",
    pilotFirstName: "Jamie",
    pilotLastName: "Nguyen",
    pilotId: "stu-bbb-2222",
    status: 1,
  },
  {
    reservationId: "res-003",
    reservationNumber: 10003,
    resource: "N67890 - Piper PA-28",
    start: "2026-03-16T09:00:00",
    end: "2026-03-16T11:00:00",
    pilotFirstName: "Taylor",
    pilotLastName: "Kim",
    pilotId: "stu-ccc-3333",
    status: 1,
  },
  {
    reservationId: "res-004",
    reservationNumber: 10004,
    resource: "N11111 - Cessna 182T",
    start: "2026-03-17T08:00:00",
    end: "2026-03-17T10:00:00",
    pilotFirstName: "Casey",
    pilotLastName: "Brooks",
    pilotId: "stu-eee-5555",
    status: 1,
  },
  {
    reservationId: "res-005",
    reservationNumber: 10005,
    resource: "N12345 - Cessna 172S",
    start: "2026-03-17T14:00:00",
    end: "2026-03-17T16:00:00",
    pilotFirstName: "Jordan",
    pilotLastName: "Lee",
    pilotId: "stu-fff-6666",
    status: 1,
  },
];
