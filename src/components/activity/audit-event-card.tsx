"use client";

import { formatDistanceToNow } from "date-fns";
import {
  Zap,
  FileCheck,
  FileX,
  CheckCircle,
  XCircle,
  Clock,
  Mail,
  MessageSquare,
  AlertTriangle,
  ShieldCheck,
  ShieldX,
  CalendarPlus,
  CalendarX,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import type { AuditEventView } from "@/lib/types/audit-view";
import type { AuditEventType } from "@/lib/types/audit";

// ---------------------------------------------------------------------------
// Event type config — icon, color, label
// ---------------------------------------------------------------------------

interface EventTypeConfig {
  icon: React.ComponentType<{ className?: string }>;
  colorClass: string;
  label: string;
}

const eventTypeConfigs: Record<AuditEventType, EventTypeConfig> = {
  trigger_received: {
    icon: Zap,
    colorClass: "text-blue-500 bg-blue-50 dark:bg-blue-950",
    label: "Trigger Received",
  },
  trigger_processed: {
    icon: CheckCircle,
    colorClass: "text-green-500 bg-green-50 dark:bg-green-950",
    label: "Trigger Processed",
  },
  trigger_failed: {
    icon: AlertTriangle,
    colorClass: "text-red-500 bg-red-50 dark:bg-red-950",
    label: "Trigger Failed",
  },
  trigger_skipped: {
    icon: Clock,
    colorClass: "text-gray-500 bg-gray-50 dark:bg-gray-900",
    label: "Trigger Skipped",
  },
  proposal_generated: {
    icon: FileCheck,
    colorClass: "text-indigo-500 bg-indigo-50 dark:bg-indigo-950",
    label: "Proposal Generated",
  },
  proposal_expired: {
    icon: FileX,
    colorClass: "text-amber-500 bg-amber-50 dark:bg-amber-950",
    label: "Proposal Expired",
  },
  proposal_approved: {
    icon: CheckCircle,
    colorClass: "text-green-600 bg-green-50 dark:bg-green-950",
    label: "Proposal Approved",
  },
  proposal_declined: {
    icon: XCircle,
    colorClass: "text-red-500 bg-red-50 dark:bg-red-950",
    label: "Proposal Declined",
  },
  validation_passed: {
    icon: ShieldCheck,
    colorClass: "text-emerald-500 bg-emerald-50 dark:bg-emerald-950",
    label: "Validation Passed",
  },
  validation_failed: {
    icon: ShieldX,
    colorClass: "text-orange-500 bg-orange-50 dark:bg-orange-950",
    label: "Validation Failed",
  },
  reservation_created: {
    icon: CalendarPlus,
    colorClass: "text-green-600 bg-green-50 dark:bg-green-950",
    label: "Reservation Created",
  },
  reservation_failed: {
    icon: CalendarX,
    colorClass: "text-red-600 bg-red-50 dark:bg-red-950",
    label: "Reservation Failed",
  },
  email_sent: {
    icon: Mail,
    colorClass: "text-sky-500 bg-sky-50 dark:bg-sky-950",
    label: "Email Sent",
  },
  email_failed: {
    icon: Mail,
    colorClass: "text-red-500 bg-red-50 dark:bg-red-950",
    label: "Email Failed",
  },
  sms_sent: {
    icon: MessageSquare,
    colorClass: "text-sky-500 bg-sky-50 dark:bg-sky-950",
    label: "SMS Sent",
  },
  sms_failed: {
    icon: MessageSquare,
    colorClass: "text-red-500 bg-red-50 dark:bg-red-950",
    label: "SMS Failed",
  },
};

function getConfig(eventType: AuditEventType): EventTypeConfig {
  return (
    eventTypeConfigs[eventType] ?? {
      icon: Zap,
      colorClass: "text-muted-foreground bg-muted",
      label: eventType,
    }
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AuditEventCard({ event }: { event: AuditEventView }) {
  const config = getConfig(event.eventType);
  const Icon = config.icon;
  const createdAgo = formatDistanceToNow(new Date(event.createdAt), {
    addSuffix: true,
  });

  return (
    <Card size="sm" data-testid="audit-event-card">
      <div className="flex items-start gap-3 px-4 py-3">
        {/* Icon */}
        <div
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-full",
            config.colorClass
          )}
        >
          <Icon className="size-4" />
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">
              {config.label}
            </span>
            {event.entityId && (
              <span className="text-xs text-muted-foreground/60">
                {event.entityId}
              </span>
            )}
          </div>
          <p className="text-sm font-medium leading-snug text-foreground">
            {event.summary}
          </p>
          <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
            <span>{createdAgo}</span>
            {event.userId && <span>by {event.userId}</span>}
          </div>
        </div>
      </div>
    </Card>
  );
}
