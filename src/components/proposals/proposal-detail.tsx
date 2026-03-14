"use client";

import Link from "next/link";
import { formatDistanceToNow, format } from "date-fns";
import { ArrowLeft, Clock, MapPin, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "./status-badge";
import { WorkflowBadge } from "./workflow-badge";
import { RationaleSection } from "./rationale-section";
import { ActionCard } from "./action-card";
import { ApprovalPanel } from "./approval-panel";
import { TrainingContext } from "./training-context";
import { AutoApprovedBadge } from "./auto-approved-badge";
import { RiskAssessmentSection } from "./risk-assessment-section";
import type { RiskAssessmentData } from "./risk-assessment-section";
import { useProposalDetail } from "@/lib/hooks/use-proposal-detail";

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

export function ProposalDetailSkeleton() {
  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6" data-testid="proposal-detail-skeleton">
      <Skeleton className="h-8 w-48" />
      <div className="flex flex-col gap-3">
        <Skeleton className="h-6 w-96" />
        <Skeleton className="h-4 w-64" />
      </div>
      <Skeleton className="h-24 w-full" />
      <div className="flex flex-col gap-3">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
      <Skeleton className="h-16 w-full" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Not found state
// ---------------------------------------------------------------------------

function ProposalNotFound() {
  return (
    <div className="flex flex-col items-center gap-4 p-12 text-center" data-testid="proposal-not-found">
      <AlertTriangle className="size-10 text-muted-foreground" />
      <div>
        <h2 className="text-lg font-semibold">Proposal not found</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          This proposal may have been removed or the ID is incorrect.
        </p>
      </div>
      <Link href="/proposals">
        <Button variant="outline">
          <ArrowLeft className="size-4" data-icon="inline-start" />
          Back to proposals
        </Button>
      </Link>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Trigger context display
// ---------------------------------------------------------------------------

function TriggerContext({ context }: { context: Record<string, unknown> }) {
  const triggerType = context.type as string | undefined;
  const originalReservationId = context.originalReservationId
    ? String(context.originalReservationId)
    : null;
  const reason = context.reason ? String(context.reason) : null;

  const descriptions: Record<string, string> = {
    cancellation: "Triggered by a reservation cancellation",
    discovery_request: "Triggered by a new discovery flight inquiry",
    lesson_complete: "Triggered by a completed lesson",
    opening_detected: "Triggered by a detected schedule opening",
    manual: "Manually created",
  };

  const description = triggerType
    ? descriptions[triggerType] ?? `Trigger: ${triggerType}`
    : "Unknown trigger";

  return (
    <div
      data-testid="trigger-context"
      className="rounded-md bg-muted/50 px-3 py-2"
    >
      <p className="text-xs font-medium text-muted-foreground">{description}</p>
      {originalReservationId && (
        <p className="mt-0.5 text-xs text-muted-foreground/70">
          Original reservation: {originalReservationId}
        </p>
      )}
      {reason && (
        <p className="mt-0.5 text-xs text-muted-foreground/70">
          Reason: {reason}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main detail component
// ---------------------------------------------------------------------------

interface ProposalDetailProps {
  proposalId: string;
}

export function ProposalDetail({ proposalId }: ProposalDetailProps) {
  const { data: proposal, isLoading, isError } = useProposalDetail(proposalId);

  if (isLoading) {
    return <ProposalDetailSkeleton />;
  }

  if (isError || !proposal) {
    return <ProposalNotFound />;
  }

  const createdAgo = formatDistanceToNow(new Date(proposal.createdAt), {
    addSuffix: true,
  });
  const proposedTime = format(
    new Date(proposal.proposedStartTime),
    "EEE, MMM d 'at' h:mm a"
  );
  const isHighPriority = proposal.priority >= 7;

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6" data-testid="proposal-detail">
      {/* Back link */}
      <Link
        href="/proposals"
        className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to proposals
      </Link>

      {/* Header */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <WorkflowBadge workflowType={proposal.workflowType} />
          <StatusBadge status={proposal.status} />
          {proposal.autoApproved && <AutoApprovedBadge />}
          {isHighPriority && proposal.status === "pending" && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400">
              <AlertTriangle className="size-3" />
              High Priority
            </span>
          )}
        </div>

        <h1 className="text-lg font-semibold leading-snug tracking-tight">
          {proposal.summary}
        </h1>

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
          <span>Created {createdAgo}</span>
          {proposal.expiresAt && (
            <span className="text-amber-600 dark:text-amber-400">
              Expires{" "}
              {formatDistanceToNow(new Date(proposal.expiresAt), {
                addSuffix: true,
              })}
            </span>
          )}
        </div>
      </div>

      <Separator />

      {/* Trigger context */}
      {proposal.triggerContext ? (
        <TriggerContext context={proposal.triggerContext} />
      ) : null}

      {/* Training context for next_lesson proposals */}
      {proposal.workflowType === "next_lesson" && proposal.trainingContext && (
        <TrainingContext data={proposal.trainingContext} />
      )}

      {/* AI rationale */}
      <RationaleSection
        summary={proposal.summary}
        rationale={proposal.rationale}
      />

      {/* Risk assessment */}
      {proposal.validationSnapshot != null &&
        "decision" in (proposal.validationSnapshot as Record<string, unknown>) ? (
          <>
            <Separator />
            <RiskAssessmentSection
              data={proposal.validationSnapshot as unknown as RiskAssessmentData}
            />
          </>
        ) : null}

      <Separator />

      {/* Actions */}
      <section>
        <h2 className="mb-3 text-sm font-semibold">
          Proposed Actions ({proposal.actions.length})
        </h2>
        <div className="flex flex-col gap-3">
          {proposal.actions.map((action) => (
            <ActionCard key={action.id} action={action} />
          ))}
        </div>
      </section>

      <Separator />

      {/* Approval panel */}
      <ApprovalPanel proposalId={proposal.id} status={proposal.status} />
    </div>
  );
}
