import type { FspEnrollment, FspEnrollmentProgress } from "@/lib/types/fsp";

export const mockEnrollments: FspEnrollment[] = [
  {
    enrollmentId: "enr-001",
    studentId: "stu-aaa-1111",
    courseId: "crs-ppl",
    courseName: "Private Pilot License",
    startDate: "2025-11-01",
    status: "Active",
  },
  {
    enrollmentId: "enr-002",
    studentId: "stu-bbb-2222",
    courseId: "crs-ppl",
    courseName: "Private Pilot License",
    startDate: "2025-12-15",
    status: "Active",
  },
  {
    enrollmentId: "enr-003",
    studentId: "stu-ccc-3333",
    courseId: "crs-ir",
    courseName: "Instrument Rating",
    startDate: "2026-01-10",
    status: "Active",
  },
  {
    enrollmentId: "enr-004",
    studentId: "stu-eee-5555",
    courseId: "crs-ppl",
    courseName: "Private Pilot License",
    startDate: "2025-10-01",
    status: "Active",
  },
];

export const mockEnrollmentProgress: Record<string, FspEnrollmentProgress> = {
  "enr-001": {
    enrollmentId: "enr-001",
    completedLessons: 7,
    totalLessons: 35,
    completedFlightHours: 14.5,
    requiredFlightHours: 40,
  },
  "enr-002": {
    enrollmentId: "enr-002",
    completedLessons: 9,
    totalLessons: 35,
    completedFlightHours: 18.0,
    requiredFlightHours: 40,
  },
  "enr-003": {
    enrollmentId: "enr-003",
    completedLessons: 5,
    totalLessons: 25,
    completedFlightHours: 10.0,
    requiredFlightHours: 40,
  },
  "enr-004": {
    enrollmentId: "enr-004",
    completedLessons: 13,
    totalLessons: 35,
    completedFlightHours: 26.0,
    requiredFlightHours: 40,
  },
};
