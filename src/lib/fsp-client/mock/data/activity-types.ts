import type { FspActivityType } from "@/lib/types/fsp";

export const mockActivityTypes: FspActivityType[] = [
  {
    id: "at-1",
    name: "Dual Flight",
    displayType: 0,
    isActive: true,
  },
  {
    id: "at-2",
    name: "Solo Flight",
    displayType: 0,
    isActive: true,
  },
  {
    id: "at-3",
    name: "Ground School",
    displayType: 2,
    isActive: true,
  },
  {
    id: "at-4",
    name: "Discovery Flight",
    displayType: 0,
    isActive: true,
  },
];
