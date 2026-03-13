"use client";

import { format } from "date-fns";
import {
  Plane,
  User,
  MapPin,
  CheckCircle,
  AlertCircle,
  Clock,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import type { ProposalActionView } from "@/lib/types/proposal-detail";
import type { ValidationStatus } from "@/lib/types/domain";

const validationConfig: Record<
  ValidationStatus,
  { label: string; className: string; icon: typeof CheckCircle }
> = {
  valid: {
    label: "Validated",
    className: "text-green-600 dark:text-green-400",
    icon: CheckCircle,
  },
  invalid: {
    label: "Invalid",
    className: "text-red-600 dark:text-red-400",
    icon: AlertCircle,
  },
  pending: {
    label: "Pending Validation",
    className: "text-amber-600 dark:text-amber-400",
    icon: Clock,
  },
  stale: {
    label: "Stale",
    className: "text-gray-500 dark:text-gray-400",
    icon: AlertCircle,
  },
};

function formatTimeRange(start: string, end: string): string {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const dayAndStart = format(startDate, "EEE, MMM d, h:mm a");
  const endTime = format(endDate, "h:mm a");
  return `${dayAndStart} – ${endTime}`;
}

export function ActionCard({ action }: { action: ProposalActionView }) {
  const validation = validationConfig[action.validationStatus];
  const ValidationIcon = validation.icon;

  return (
    <Card size="sm" data-testid={`action-card-${action.id}`}>
      <CardContent className="flex flex-col gap-3">
        {/* Rank + time header */}
        <div className="flex items-start gap-3">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
            {action.rank}
          </span>
          <div className="flex flex-1 flex-col gap-1">
            <p className="text-sm font-medium">
              {formatTimeRange(action.startTime, action.endTime)}
            </p>
            {action.activityTypeName && (
              <p className="text-xs text-muted-foreground">
                {action.activityTypeName}
              </p>
            )}
          </div>
          {/* Validation status */}
          <span
            className={cn(
              "inline-flex items-center gap-1 text-xs font-medium",
              validation.className
            )}
          >
            <ValidationIcon className="size-3.5" />
            {validation.label}
          </span>
        </div>

        {/* Resource details */}
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <User className="size-3" />
            {action.studentName}
          </span>
          {action.instructorName && (
            <span className="inline-flex items-center gap-1">
              <User className="size-3" />
              {action.instructorName}
            </span>
          )}
          {action.aircraftRegistration && (
            <span className="inline-flex items-center gap-1">
              <Plane className="size-3" />
              {action.aircraftRegistration}
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <MapPin className="size-3" />
            {action.locationName}
          </span>
        </div>

        {/* AI explanation */}
        {action.explanation && (
          <div className="rounded-md bg-muted/50 px-3 py-2">
            <p className="flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground">
              <Sparkles className="mt-0.5 size-3 shrink-0 text-primary/60" />
              {action.explanation}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
