"use client";

import { useState } from "react";
import { formatDistanceToNow, format } from "date-fns";
import {
  AlertTriangle,
  Clock,
  MapPin,
  ChevronDown,
  ChevronUp,
  Users,
  Check,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { StatusBadge } from "./status-badge";
import { WorkflowBadge } from "./workflow-badge";
import type { ProposalView } from "@/lib/types/proposal-view";

interface GroupedProposalCardProps {
  /** The opening/slot this group represents */
  groupLabel: string;
  /** Candidates ranked for this opening */
  candidates: ProposalView[];
  /** Whether the group is in batch selection mode */
  selectionMode?: boolean;
  /** Currently selected IDs */
  selectedIds?: Set<string>;
  /** Toggle selection for a candidate */
  onToggleSelect?: (id: string) => void;
}

export function GroupedProposalCard({
  groupLabel,
  candidates,
  selectionMode,
  selectedIds,
  onToggleSelect,
}: GroupedProposalCardProps) {
  const [expanded, setExpanded] = useState(false);
  const topCandidate = candidates[0];
  if (!topCandidate) return null;

  const isHighPriority = topCandidate.priority >= 7;
  const createdAgo = formatDistanceToNow(new Date(topCandidate.createdAt), {
    addSuffix: true,
  });

  return (
    <Card
      className={cn(
        "transition-shadow",
        isHighPriority &&
          topCandidate.status === "pending" &&
          "ring-amber-300/50"
      )}
    >
      <div className="flex flex-col gap-2 px-4 py-3">
        {/* Group header */}
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1">
            <Users className="size-3" />
            {candidates.length} candidate{candidates.length !== 1 ? "s" : ""}
          </Badge>
          <WorkflowBadge workflowType={topCandidate.workflowType} />
          <StatusBadge status={topCandidate.status} />
          {isHighPriority && topCandidate.status === "pending" && (
            <span className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400">
              <AlertTriangle className="size-3" />
              High Priority
            </span>
          )}
        </div>

        {/* Group label */}
        <p className="text-xs font-medium text-muted-foreground">
          {groupLabel}
        </p>

        {/* Top candidate summary */}
        <p className="text-sm font-medium leading-snug text-foreground">
          {topCandidate.summary}
        </p>

        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <MapPin className="size-3" />
            {topCandidate.locationName}
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3" />
            {format(
              new Date(topCandidate.proposedStartTime),
              "EEE, MMM d 'at' h:mm a"
            )}
          </span>
          <span className="ml-auto text-muted-foreground/70">
            {createdAgo}
          </span>
        </div>

        {/* Expand/collapse */}
        {candidates.length > 1 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            className="self-start"
          >
            {expanded ? (
              <ChevronUp className="size-3.5" data-icon="inline-start" />
            ) : (
              <ChevronDown className="size-3.5" data-icon="inline-start" />
            )}
            {expanded ? "Hide" : "Show"} all candidates
          </Button>
        )}

        {/* Expanded candidate list */}
        {expanded && (
          <div className="flex flex-col gap-1.5 border-t pt-2">
            {candidates.map((candidate, idx) => (
              <div
                key={candidate.id}
                className={cn(
                  "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm",
                  selectionMode && selectedIds?.has(candidate.id) && "bg-muted"
                )}
              >
                {selectionMode && onToggleSelect && (
                  <Checkbox
                    checked={selectedIds?.has(candidate.id) ?? false}
                    onCheckedChange={() => onToggleSelect(candidate.id)}
                  />
                )}
                <span className="flex size-5 items-center justify-center rounded-full bg-muted text-xs font-medium">
                  {idx + 1}
                </span>
                <span className="flex-1 truncate text-xs">
                  {candidate.summary}
                </span>
                <span className="text-xs text-muted-foreground">
                  {candidate.studentNames.join(", ")}
                </span>
                {candidate.status === "pending" && (
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      className="text-green-600 hover:text-green-700"
                    >
                      <Check className="size-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      className="text-destructive"
                    >
                      <X className="size-3" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
