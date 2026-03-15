import type { FspScheduleResponse } from "@/lib/types/fsp";

/**
 * A week of schedule data centered around 2026-03-15 (today).
 * Times are local (Pacific).
 *
 * Active students: Alex Rivera, Jamie Nguyen, Taylor Kim, Jordan Lee
 * Inactive students (no events): Morgan Patel, Casey Brooks
 */
export const mockSchedule: FspScheduleResponse = {
  results: {
    events: [
      // --- Past events (recent activity for active students) ---
      {
        Start: "2026-03-10T08:00:00",
        End: "2026-03-10T10:00:00",
        Title: "Dual Flight - PPL Lesson 4",
        CustomerName: "Alex Rivera",
        InstructorName: "Sarah Chen",
        AircraftName: "N12345 - Cessna 172S",
      },
      {
        Start: "2026-03-12T10:30:00",
        End: "2026-03-12T12:30:00",
        Title: "Dual Flight - PPL Lesson 7",
        CustomerName: "Jamie Nguyen",
        InstructorName: "Sarah Chen",
        AircraftName: "N12345 - Cessna 172S",
      },
      {
        Start: "2026-03-13T09:00:00",
        End: "2026-03-13T11:00:00",
        Title: "Dual Flight - IR Lesson 2",
        CustomerName: "Taylor Kim",
        InstructorName: "Mike Johnson",
        AircraftName: "N67890 - Piper PA-28",
      },
      // --- Future events (upcoming for active students) ---
      {
        Start: "2026-03-16T08:00:00",
        End: "2026-03-16T10:00:00",
        Title: "Dual Flight - PPL Lesson 5",
        CustomerName: "Alex Rivera",
        InstructorName: "Sarah Chen",
        AircraftName: "N12345 - Cessna 172S",
      },
      {
        Start: "2026-03-16T10:30:00",
        End: "2026-03-16T12:30:00",
        Title: "Dual Flight - PPL Lesson 8",
        CustomerName: "Jamie Nguyen",
        InstructorName: "Sarah Chen",
        AircraftName: "N12345 - Cessna 172S",
      },
      {
        Start: "2026-03-16T09:00:00",
        End: "2026-03-16T11:00:00",
        Title: "Dual Flight - IR Lesson 3",
        CustomerName: "Taylor Kim",
        InstructorName: "Mike Johnson",
        AircraftName: "N67890 - Piper PA-28",
      },
      {
        Start: "2026-03-17T14:00:00",
        End: "2026-03-17T16:00:00",
        Title: "Discovery Flight",
        CustomerName: "Jordan Lee",
        InstructorName: "Sarah Chen",
        AircraftName: "N12345 - Cessna 172S",
      },
      {
        Start: "2026-03-18T07:00:00",
        End: "2026-03-18T09:00:00",
        Title: "Dual Flight - PPL Lesson 6",
        CustomerName: "Alex Rivera",
        InstructorName: "David Wilson",
        AircraftName: "N67890 - Piper PA-28",
      },
      {
        Start: "2026-03-18T09:30:00",
        End: "2026-03-18T11:30:00",
        Title: "Dual Flight - IR Lesson 4",
        CustomerName: "Taylor Kim",
        InstructorName: "Mike Johnson",
        AircraftName: "N67890 - Piper PA-28",
      },
      {
        Start: "2026-03-19T08:00:00",
        End: "2026-03-19T10:00:00",
        Title: "Dual Flight - PPL Lesson 9",
        CustomerName: "Jamie Nguyen",
        InstructorName: "Sarah Chen",
        AircraftName: "N12345 - Cessna 172S",
      },
      {
        Start: "2026-03-20T08:00:00",
        End: "2026-03-20T10:00:00",
        Title: "Dual Flight - PPL Lesson 7",
        CustomerName: "Alex Rivera",
        InstructorName: "Sarah Chen",
        AircraftName: "N12345 - Cessna 172S",
      },
      {
        Start: "2026-03-21T09:00:00",
        End: "2026-03-21T11:00:00",
        Title: "Dual Flight - IR Lesson 5",
        CustomerName: "Taylor Kim",
        InstructorName: "Mike Johnson",
        AircraftName: "N67890 - Piper PA-28",
      },
    ],
    resources: [],
    unavailability: [
      {
        ResourceId: "ac-3",
        StartDate: "2026-03-18T00:00:00",
        EndDate: "2026-03-18T23:59:59",
        Name: "N11111 - 100hr Inspection",
      },
    ],
  },
};
