"use client";

import Link from "next/link";
import { formatDistanceToNow, format } from "date-fns";
import { AlertTriangle, Clock, MapPin, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { StatusBadge } from "./status-badge";
import { WorkflowBadge } from "./workflow-badge";
import type { ProposalView } from "@/lib/types/proposal-view";

interface ProposalCardProps {
  proposal: ProposalView;
  selectionMode?: boolean;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
}

export function ProposalCard({
  proposal,
  selectionMode,
  selected,
  onToggleSelect,
}: ProposalCardProps) {
  const isHighPriority = proposal.priority >= 7;
  const createdAgo = formatDistanceToNow(new Date(proposal.createdAt), {
    addSuffix: true,
  });
  const proposedTime = format(new Date(proposal.proposedStartTime), "EEE, MMM d 'at' h:mm a");

  const cardContent = (
    <Card
      size="sm"
      className={cn(
        "transition-shadow hover:ring-2 hover:ring-primary/20 hover:shadow-md",
        isHighPriority && proposal.status === "pending" && "ring-amber-300/50",
        selected && "ring-2 ring-primary/40 bg-primary/5"
      )}
    >
      <div className="flex gap-3 px-4 py-3">
        {/* Batch selection checkbox */}
        {selectionMode && (
          <div className="flex items-start pt-0.5">
            <Checkbox
              checked={selected}
              onCheckedChange={() => onToggleSelect?.(proposal.id)}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}

        <div className="flex flex-1 flex-col gap-2">
          {/* Top row: badges + priority */}
          <div className="flex items-center gap-2">
            <WorkflowBadge workflowType={proposal.workflowType} />
            <StatusBadge status={proposal.status} />
            {isHighPriority && proposal.status === "pending" && (
              <span className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                <AlertTriangle className="size-3" />
                High Priority
              </span>
            )}
            <ChevronRight className="ml-auto size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
          </div>

          {/* Summary */}
          <p className="text-sm font-medium leading-snug text-foreground">
            {proposal.summary}
          </p>

          {/* Rationale snippet */}
          <p className="line-clamp-2 text-xs text-muted-foreground">
            {proposal.rationale}
          </p>

          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">
              {proposal.studentNames.join(", ")}
            </span>
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3" />
              {proposal.locationName}
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3" />
              {proposedTime}
            </span>
            <span className="ml-auto text-muted-foreground/70">
              {createdAgo}
            </span>
          </div>
        </div>
      </div>
    </Card>
  );

  if (selectionMode) {
    return (
      <div
        className="group block cursor-pointer"
        onClick={() => onToggleSelect?.(proposal.id)}
      >
        {cardContent}
      </div>
    );
  }

  return (
    <Link href={`/proposals/${proposal.id}`} className="group block">
      {cardContent}
    </Link>
  );
}
