"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { UpdateOperatorSettingsRequest } from "@/lib/types/api";
import { apiFetch } from "@/lib/api/client";

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
  inactivityThresholdDays: number;
  enabledWorkflows: {
    reschedule: boolean;
    discovery_flight: boolean;
    next_lesson: boolean;
    waitlist: boolean;
    inactivity_outreach: boolean;
  };
  communicationPreferences: {
    email: boolean;
    sms: boolean;
  };
  customWeights: Array<{
    name: string;
    signal: "daysSinceLastFlight" | "daysUntilExpiry" | "totalHours" | "lessonCompletionRate";
    weight: number;
    enabled: boolean;
  }>;
  communicationTemplates: Record<string, { subject: string; body: string }> | null;
  brandColor: string;
  logoUrl: string | null;
  autoApprovalEnabled: boolean;
  autoApprovalThreshold: number;
}

export function useOperatorSettings() {
  return useQuery({
    queryKey: ["operator-settings"],
    queryFn: async () => {
      const data = await apiFetch<{ settings: OperatorSettings }>(
        `/api/settings`,
      );
      return data.settings;
    },
  });
}

export function useUpdateOperatorSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (update: UpdateOperatorSettingsRequest) => {
      await apiFetch(`/api/settings`, {
        method: "PATCH",
        body: JSON.stringify(update),
      });
    },
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
      await apiFetch(`/api/settings/reset`, {
        method: "POST",
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["operator-settings"],
      });
    },
  });
}
