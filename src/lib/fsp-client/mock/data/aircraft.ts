import type { FspAircraft } from "@/lib/types/fsp";

export const mockAircraft: FspAircraft[] = [
  {
    id: "ac-1",
    registration: "N12345",
    make: "Cessna",
    model: "172S",
    makeModel: "Cessna 172S Skyhawk",
    isActive: true,
    isSimulator: false,
  },
  {
    id: "ac-2",
    registration: "N67890",
    make: "Piper",
    model: "PA-28-181",
    makeModel: "Piper PA-28-181 Archer",
    isActive: true,
    isSimulator: false,
  },
  {
    id: "ac-3",
    registration: "N11111",
    make: "Cessna",
    model: "182T",
    makeModel: "Cessna 182T Skylane",
    isActive: true,
    isSimulator: false,
  },
  {
    id: "ac-4",
    registration: "N22222",
    make: "Cessna",
    model: "172R",
    makeModel: "Cessna 172R Skyhawk",
    isActive: true,
    isSimulator: false,
  },
  {
    id: "ac-5",
    registration: "SIM-01",
    make: "Redbird",
    model: "TD2",
    makeModel: "Redbird TD2 Simulator",
    isActive: true,
    isSimulator: true,
  },
];
