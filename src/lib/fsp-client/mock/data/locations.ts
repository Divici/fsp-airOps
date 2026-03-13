import type { FspLocation } from "@/lib/types/fsp";

export const mockLocations: FspLocation[] = [
  {
    id: "loc-1",
    name: "Palo Alto Airport",
    code: "KPAO",
    timeZone: "America/Los_Angeles",
    isActive: true,
  },
  {
    id: "loc-2",
    name: "San Carlos Airport",
    code: "KSQL",
    timeZone: "America/Los_Angeles",
    isActive: true,
  },
  {
    id: "loc-3",
    name: "Hayward Executive Airport",
    code: "KHWD",
    timeZone: "America/Los_Angeles",
    isActive: true,
  },
];
