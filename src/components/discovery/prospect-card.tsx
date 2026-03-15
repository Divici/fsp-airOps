"use client";

import { NavLink } from "@/components/layout/nav-context";
import { formatDistanceToNow, format } from "date-fns";
import { Mail, Phone, Calendar, Clock, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ProspectStatusBadge } from "./prospect-status-badge";
import type { ProspectView } from "@/lib/types/prospect-view";

export function ProspectCard({ prospect }: { prospect: ProspectView }) {
  const createdAgo = formatDistanceToNow(new Date(prospect.createdAt), {
    addSuffix: true,
  });

  const preferredDateFormatted = prospect.preferredDate
    ? format(new Date(prospect.preferredDate + "T00:00:00"), "EEE, MMM d")
    : null;

  return (
    <NavLink href={`/discovery/${prospect.id}`} className="group block">
      <Card
        size="sm"
        className="transition-shadow hover:ring-2 hover:ring-primary/20 hover:shadow-md"
      >
        <div className="flex flex-col gap-2 px-4 py-3">
          {/* Top row: status badge */}
          <div className="flex items-center gap-2">
            <ProspectStatusBadge status={prospect.status} />
            <ChevronRight className="ml-auto size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
          </div>

          {/* Name */}
          <p className="text-sm font-medium leading-snug text-foreground">
            {prospect.firstName} {prospect.lastName}
          </p>

          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Mail className="size-3" />
              {prospect.email}
            </span>
            {prospect.phone && (
              <span className="inline-flex items-center gap-1">
                <Phone className="size-3" />
                {prospect.phone}
              </span>
            )}
            {preferredDateFormatted && (
              <span className="inline-flex items-center gap-1">
                <Calendar className="size-3" />
                {preferredDateFormatted}
              </span>
            )}
            {prospect.preferredTimeOfDay && (
              <span className="inline-flex items-center gap-1">
                <Clock className="size-3" />
                {prospect.preferredTimeOfDay}
              </span>
            )}
            <span className="ml-auto text-muted-foreground/70">
              {createdAgo}
            </span>
          </div>
        </div>
      </Card>
    </NavLink>
  );
}
