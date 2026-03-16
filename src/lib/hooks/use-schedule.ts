"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/client";

export interface ScheduleEvent {
  id: string;
  title: string;
  studentName: string;
  instructorName: string;
  aircraftName: string;
  start: string;
  end: string;
  type: string;
}

interface ScheduleResponse {
  events: ScheduleEvent[];
}

export function useSchedule(startDate: string, endDate: string) {
  return useQuery({
    queryKey: ["schedule", startDate, endDate],
    queryFn: async () => {
      const data = await apiFetch<ScheduleResponse>(
        `/api/schedule?start=${startDate}&end=${endDate}`
      );
      return data.events;
    },
    enabled: !!startDate && !!endDate,
  });
}
