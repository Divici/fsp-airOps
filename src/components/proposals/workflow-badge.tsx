import {
  ArrowRightLeft,
  Plane,
  GraduationCap,
  Clock,
  UserX,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { WorkflowType } from "@/lib/types/domain";

const workflowConfig: Record<
  WorkflowType,
  { label: string; icon: LucideIcon; className: string }
> = {
  reschedule: {
    label: "Reschedule",
    icon: ArrowRightLeft,
    className: "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400",
  },
  discovery_flight: {
    label: "Discovery Flight",
    icon: Plane,
    className: "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-400",
  },
  next_lesson: {
    label: "Next Lesson",
    icon: GraduationCap,
    className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  },
  waitlist: {
    label: "Waitlist",
    icon: Clock,
    className: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  },
  inactivity_outreach: {
    label: "Inactive Student",
    icon: UserX,
    className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  },
};

export function WorkflowBadge({
  workflowType,
  className,
}: {
  workflowType: WorkflowType;
  className?: string;
}) {
  const config = workflowConfig[workflowType];
  const Icon = config.icon;

  return (
    <span
      data-testid={`workflow-badge-${workflowType}`}
      className={cn(
        "inline-flex h-5 items-center gap-1 rounded-full px-2 text-xs font-medium",
        config.className,
        className
      )}
    >
      <Icon className="size-3" />
      {config.label}
    </span>
  );
}
