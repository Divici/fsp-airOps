import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DEFAULT_OPERATOR_SETTINGS } from "@/config/defaults";
import type { UpdateOperatorSettingsRequest } from "@/lib/types/api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OperatorSettings {
  timeSinceLastFlightWeight: number;
  timeUntilNextFlightWeight: number;
  totalFlightHoursWeight: number;
  preferSameInstructor: boolean;
  preferSameInstructorWeight: number;
  preferSameAircraft: boolean;
  preferSameAircraftWeight: number;
  searchWindowDays: number;
  topNAlternatives: number;
  daylightOnly: boolean;
  enabledWorkflows: {
    reschedule: boolean;
    discovery_flight: boolean;
    next_lesson: boolean;
    waitlist: boolean;
  };
  communicationPreferences: {
    email: boolean;
    sms: boolean;
  };
}

// ---------------------------------------------------------------------------
// Mock data — replaced with real API call later
// ---------------------------------------------------------------------------

let mockSettings: OperatorSettings = { ...DEFAULT_OPERATOR_SETTINGS };

async function fetchOperatorSettings(): Promise<OperatorSettings> {
  await new Promise((r) => setTimeout(r, 300));
  return { ...mockSettings };
}

async function updateOperatorSettings(
  update: UpdateOperatorSettingsRequest
): Promise<OperatorSettings> {
  await new Promise((r) => setTimeout(r, 400));
  mockSettings = {
    ...mockSettings,
    ...update,
    enabledWorkflows: {
      ...mockSettings.enabledWorkflows,
      ...update.enabledWorkflows,
    },
    communicationPreferences: {
      ...mockSettings.communicationPreferences,
      ...update.communicationPreferences,
    },
  };
  return { ...mockSettings };
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export function useOperatorSettings() {
  return useQuery({
    queryKey: ["operator-settings"],
    queryFn: fetchOperatorSettings,
  });
}

export function useUpdateOperatorSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (update: UpdateOperatorSettingsRequest) =>
      updateOperatorSettings(update),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["operator-settings"],
      });
    },
  });
}

export function useResetOperatorSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      await new Promise((r) => setTimeout(r, 400));
      mockSettings = { ...DEFAULT_OPERATOR_SETTINGS };
      return { ...mockSettings };
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["operator-settings"],
      });
    },
  });
}
