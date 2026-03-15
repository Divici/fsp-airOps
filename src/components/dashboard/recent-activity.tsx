"use client";

import { NavLink } from "@/components/layout/nav-context";
import { formatDistanceToNow } from "date-fns";
import {
  FileText,
  CheckCircle,
  XCircle,
  AlertTriangle,
  AlertCircle,
  Zap,
  Brain,
  Shield,
  Inbox,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useRecentActivity } from "@/lib/hooks/use-dashboard-metrics";
import type { RecentActivityItem } from "@/lib/types/dashboard-metrics";

const EVENT_ICONS: Record<string, React.ReactNode> = {
  proposal_generated: <FileText className="size-4 text-blue-500" />,
  proposal_approved: <CheckCircle className="size-4 text-green-500" />,
  proposal_declined: <XCircle className="size-4 text-red-500" />,
  proposal_expired: <AlertTriangle className="size-4 text-amber-500" />,
  reservation_created: <Zap className="size-4 text-purple-500" />,
  trigger_received: <AlertTriangle className="size-4 text-orange-500" />,
  proposal_auto_approved: <Zap className="size-4 text-purple-500" />,
  proposal_auto_deferred: <Brain className="size-4 text-amber-500" />,
  risk_assessed: <Shield className="size-4 text-blue-500" />,
};

function ActivityRow({ item }: { item: RecentActivityItem }) {
  const icon = EVENT_ICONS[item.eventType] ?? (
    <FileText className="size-4 text-muted-foreground" />
  );
  const timeAgo = formatDistanceToNow(new Date(item.timestamp), {
    addSuffix: true,
  });

  return (
    <div className="flex items-start gap-3 py-2">
      <div className="mt-0.5 flex-shrink-0">{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-snug text-foreground">{item.summary}</p>
        <p className="text-xs text-muted-foreground">{timeAgo}</p>
      </div>
    </div>
  );
}

function ActivitySkeleton() {
  return (
    <div className="flex items-start gap-3 py-2">
      <Skeleton className="mt-0.5 size-4 rounded" />
      <div className="flex-1 space-y-1">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-20" />
      </div>
    </div>
  );
}

export function RecentActivity() {
  const { data, isLoading, isError, refetch } = useRecentActivity();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        {isError ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-8">
            <AlertCircle className="size-8 text-destructive opacity-60" />
            <p className="text-sm font-medium">Unable to load recent activity</p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Try again
            </Button>
          </div>
        ) : isLoading || !data ? (
          <div className="divide-y">
            {Array.from({ length: 5 }).map((_, i) => (
              <ActivitySkeleton key={i} />
            ))}
          </div>
        ) : data.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
            <Inbox className="size-8 opacity-40" />
            <p className="text-sm font-medium">No recent activity</p>
            <p className="max-w-xs text-center text-xs">
              Events will appear here as the system processes scheduling
              triggers.
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {data.slice(0, 5).map((item) => (
              <ActivityRow key={item.id} item={item} />
            ))}
          </div>
        )}

        <div className="mt-3 border-t pt-3">
          <NavLink
            href="/activity"
            className="text-xs font-medium text-primary hover:underline"
          >
            View all activity
          </NavLink>
        </div>
      </CardContent>
    </Card>
  );
}
