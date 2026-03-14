import { cn } from "@/lib/utils";
import type { ProposalStatus } from "@/lib/types/domain";

const statusConfig: Record<
  ProposalStatus,
  { label: string; className: string }
> = {
  pending: {
    label: "Pending",
    className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  },
  approved: {
    label: "Approved",
    className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  },
  declined: {
    label: "Declined",
    className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  },
  expired: {
    label: "Expired",
    className: "bg-gray-100 text-gray-600 dark:bg-gray-800/30 dark:text-gray-400",
  },
  executed: {
    label: "Approved",
    className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  },
  failed: {
    label: "Failed",
    className: "bg-red-200 text-red-900 dark:bg-red-900/40 dark:text-red-300",
  },
  draft: {
    label: "Draft",
    className: "bg-gray-50 text-gray-500 dark:bg-gray-800/20 dark:text-gray-500",
  },
};

export function StatusBadge({
  status,
  className,
}: {
  status: ProposalStatus;
  className?: string;
}) {
  const config = statusConfig[status];

  return (
    <span
      data-testid={`status-badge-${status}`}
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
