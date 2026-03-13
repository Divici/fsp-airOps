import type { FspInstructor } from "@/lib/types/fsp";

export const mockInstructors: FspInstructor[] = [
  {
    id: "inst-aaa-1111",
    firstName: "Sarah",
    lastName: "Chen",
    fullName: "Sarah Chen",
    instructorType: "CFI",
    isActive: true,
  },
  {
    id: "inst-bbb-2222",
    firstName: "Mike",
    lastName: "Johnson",
    fullName: "Mike Johnson",
    instructorType: "CFII",
    isActive: true,
  },
  {
    id: "inst-ccc-3333",
    firstName: "Lisa",
    lastName: "Park",
    fullName: "Lisa Park",
    instructorType: "CFI",
    isActive: true,
  },
  {
    id: "inst-ddd-4444",
    firstName: "David",
    lastName: "Wilson",
    fullName: "David Wilson",
    instructorType: "CFII/MEI",
    isActive: true,
  },
];
