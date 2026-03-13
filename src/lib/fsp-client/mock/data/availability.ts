import type { FspAvailability } from "@/lib/types/fsp";

/**
 * Weekly availability patterns for instructors.
 * Times are in UTC. For Pacific time (UTC-8 / UTC-7):
 *   15:00 UTC = 7:00 AM PT, 01:00 UTC = 5:00 PM PT (next day offset).
 */
export const mockAvailability: FspAvailability[] = [
  {
    userGuidId: "inst-aaa-1111",
    availabilities: [
      { dayOfWeek: 1, startAtTimeUtc: "15:00", endAtTimeUtc: "01:00" },
      { dayOfWeek: 2, startAtTimeUtc: "15:00", endAtTimeUtc: "01:00" },
      { dayOfWeek: 3, startAtTimeUtc: "15:00", endAtTimeUtc: "01:00" },
      { dayOfWeek: 4, startAtTimeUtc: "15:00", endAtTimeUtc: "01:00" },
      { dayOfWeek: 5, startAtTimeUtc: "15:00", endAtTimeUtc: "01:00" },
    ],
    availabilityOverrides: [],
  },
  {
    userGuidId: "inst-bbb-2222",
    availabilities: [
      { dayOfWeek: 1, startAtTimeUtc: "17:00", endAtTimeUtc: "03:00" },
      { dayOfWeek: 2, startAtTimeUtc: "17:00", endAtTimeUtc: "03:00" },
      { dayOfWeek: 3, startAtTimeUtc: "17:00", endAtTimeUtc: "03:00" },
      { dayOfWeek: 5, startAtTimeUtc: "17:00", endAtTimeUtc: "03:00" },
      { dayOfWeek: 6, startAtTimeUtc: "16:00", endAtTimeUtc: "00:00" },
    ],
    availabilityOverrides: [],
  },
  {
    userGuidId: "inst-ccc-3333",
    availabilities: [
      { dayOfWeek: 0, startAtTimeUtc: "16:00", endAtTimeUtc: "00:00" },
      { dayOfWeek: 2, startAtTimeUtc: "15:00", endAtTimeUtc: "23:00" },
      { dayOfWeek: 4, startAtTimeUtc: "15:00", endAtTimeUtc: "23:00" },
      { dayOfWeek: 6, startAtTimeUtc: "15:00", endAtTimeUtc: "23:00" },
    ],
    availabilityOverrides: [],
  },
  {
    userGuidId: "inst-ddd-4444",
    availabilities: [
      { dayOfWeek: 1, startAtTimeUtc: "14:00", endAtTimeUtc: "22:00" },
      { dayOfWeek: 2, startAtTimeUtc: "14:00", endAtTimeUtc: "22:00" },
      { dayOfWeek: 3, startAtTimeUtc: "14:00", endAtTimeUtc: "22:00" },
      { dayOfWeek: 4, startAtTimeUtc: "14:00", endAtTimeUtc: "22:00" },
      { dayOfWeek: 5, startAtTimeUtc: "14:00", endAtTimeUtc: "22:00" },
    ],
    availabilityOverrides: [],
  },
];
