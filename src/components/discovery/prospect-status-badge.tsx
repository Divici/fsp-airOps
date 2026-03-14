"use client";

import { cn } from "@/lib/utils";
import type { ProspectStatus } from "@/lib/types/domain";

const statusConfig: Record<
  ProspectStatus,
  { label: string; className: string }
> = {
  new: {
    label: "New",
    className:
      "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  },
  processing: {
    label: "Processing",
    className:
      "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  },
  proposed: {
    label: "Proposed",
    className:
      "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400",
  },
  approved: {
    label: "Approved",
    className:
      "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  },
  booked: {
    label: "Booked",
    className:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  },
  cancelled: {
    label: "Cancelled",
    className:
      "bg-gray-100 text-gray-600 dark:bg-gray-800/30 dark:text-gray-400",
  },
};

export function ProspectStatusBadge({
  status,
  className,
}: {
  status: ProspectStatus;
  className?: string;
}) {
  const config = statusConfig[status];

  return (
    <span
      data-testid={`prospect-status-badge-${status}`}
      className={cn(
        "inline-flex h-5 items-center rounded-full px-2 text-xs font-medium",
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  );
}
