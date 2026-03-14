"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import type { RecentActivityItem } from "@/lib/types/dashboard-metrics";

/**
 * Watches recent activity data and shows a toast notification
 * whenever a new `proposal_auto_approved` event appears.
 */
export function useAutoApprovalToasts(
  activityItems: RecentActivityItem[] | undefined
) {
  const prevIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!activityItems) return;

    const currentIds = new Set(activityItems.map((item) => item.id));

    // On first load, just record the IDs without toasting
    if (prevIdsRef.current.size === 0) {
      prevIdsRef.current = currentIds;
      return;
    }

    // Find new auto-approved events
    for (const item of activityItems) {
      if (
        item.eventType === "proposal_auto_approved" &&
        !prevIdsRef.current.has(item.id)
      ) {
        toast.info("AI auto-approved a proposal", {
          description: item.summary,
        });
      }
    }

    prevIdsRef.current = currentIds;
  }, [activityItems]);
}
