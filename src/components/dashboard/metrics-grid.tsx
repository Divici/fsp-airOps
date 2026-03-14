"use client";

import Link from "next/link";
import {
  Clock,
  CheckCircle,
  XCircle,
  PlayCircle,
  Zap,
  Activity,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboardMetrics } from "@/lib/hooks/use-dashboard-metrics";
import type { DashboardMetrics } from "@/lib/types/dashboard-metrics";

interface MetricCardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  colorClass: string;
  href?: string;
}

function MetricCard({ icon, label, value, colorClass, href }: MetricCardProps) {
  const content = (
    <Card size="sm" className={href ? "transition-colors hover:border-foreground/20 hover:bg-accent/50" : ""}>
      <CardContent className="flex items-center gap-3">
        <div className={`flex size-10 items-center justify-center rounded-lg ${colorClass}`}>
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold tabular-nums">{value}</p>
        </div>
      </CardContent>
    </Card>
  );

  if (href) {
    return <Link href={href} className="block">{content}</Link>;
  }
  return content;
}

function MetricCardSkeleton() {
  return (
    <Card size="sm">
      <CardContent className="flex items-center gap-3">
        <Skeleton className="size-10 rounded-lg" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-7 w-12" />
        </div>
      </CardContent>
    </Card>
  );
}

function getMetricCards(data: DashboardMetrics): MetricCardProps[] {
  return [
    {
      icon: <Clock className="size-5 text-amber-600 dark:text-amber-400" />,
      label: "Pending Proposals",
      value: data.pendingProposals,
      colorClass: "bg-amber-100 dark:bg-amber-900/30",
      href: "/proposals?status=pending",
    },
    {
      icon: <CheckCircle className="size-5 text-green-600 dark:text-green-400" />,
      label: "Approved Today",
      value: data.approvedToday,
      colorClass: "bg-green-100 dark:bg-green-900/30",
      href: "/proposals?status=approved&date=today",
    },
    {
      icon: <XCircle className="size-5 text-red-600 dark:text-red-400" />,
      label: "Declined Today",
      value: data.declinedToday,
      colorClass: "bg-red-100 dark:bg-red-900/30",
      href: "/proposals?status=declined&date=today",
    },
    {
      icon: <PlayCircle className="size-5 text-blue-600 dark:text-blue-400" />,
      label: "Executed Today",
      value: data.executedToday,
      colorClass: "bg-blue-100 dark:bg-blue-900/30",
      href: "/proposals?status=executed&date=today",
    },
    {
      icon: <Zap className="size-5 text-purple-600 dark:text-purple-400" />,
      label: "Active Workflows",
      value: data.activeWorkflows,
      colorClass: "bg-purple-100 dark:bg-purple-900/30",
    },
    {
      icon: <Activity className="size-5 text-slate-600 dark:text-slate-400" />,
      label: "Recent Activity",
      value: data.recentActivity,
      colorClass: "bg-slate-100 dark:bg-slate-800/50",
      href: "/activity",
    },
  ];
}

export function MetricsGrid() {
  const { data, isLoading } = useDashboardMetrics();

  if (isLoading || !data) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <MetricCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  const cards = getMetricCards(data);

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((card) => (
        <MetricCard key={card.label} {...card} />
      ))}
    </div>
  );
}
