"use client";

import { NavLink } from "@/components/layout/nav-context";
import { formatDistanceToNow, format } from "date-fns";
import {
  ArrowLeft,
  Mail,
  Phone,
  Calendar,
  Clock,
  AlertTriangle,
  LinkIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { ProspectStatusBadge } from "./prospect-status-badge";
import { useProspectDetail } from "@/lib/hooks/use-prospects";
import type { ProspectStatus } from "@/lib/types/domain";

// ---------------------------------------------------------------------------
// Status pipeline
// ---------------------------------------------------------------------------

const pipelineSteps: { status: ProspectStatus; label: string }[] = [
  { status: "new", label: "New" },
  { status: "processing", label: "Processing" },
  { status: "proposed", label: "Proposed" },
  { status: "approved", label: "Approved" },
  { status: "booked", label: "Booked" },
];

function StatusPipeline({ currentStatus }: { currentStatus: ProspectStatus }) {
  if (currentStatus === "cancelled") {
    return (
      <div className="rounded-md bg-muted/50 px-3 py-2">
        <p className="text-xs font-medium text-muted-foreground">
          This request has been cancelled.
        </p>
      </div>
    );
  }

  const currentIndex = pipelineSteps.findIndex(
    (s) => s.status === currentStatus
  );

  return (
    <div className="flex items-center gap-1" data-testid="status-pipeline">
      {pipelineSteps.map((step, i) => {
        const isComplete = i < currentIndex;
        const isCurrent = i === currentIndex;

        return (
          <div key={step.status} className="flex items-center gap-1">
            {i > 0 && (
              <div
                className={`h-0.5 w-4 ${
                  isComplete
                    ? "bg-primary"
                    : "bg-muted-foreground/20"
                }`}
              />
            )}
            <div
              className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                isCurrent
                  ? "bg-primary text-primary-foreground"
                  : isComplete
                    ? "bg-primary/10 text-primary"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {step.label}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

export function ProspectDetailSkeleton() {
  return (
    <div
      className="flex flex-col gap-6 p-4 lg:p-6"
      data-testid="prospect-detail-skeleton"
    >
      <Skeleton className="h-8 w-48" />
      <div className="flex flex-col gap-3">
        <Skeleton className="h-6 w-96" />
        <Skeleton className="h-4 w-64" />
      </div>
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Not found state
// ---------------------------------------------------------------------------

function ProspectNotFound() {
  return (
    <div
      className="flex flex-col items-center gap-4 p-12 text-center"
      data-testid="prospect-not-found"
    >
      <AlertTriangle className="size-10 text-muted-foreground" />
      <div>
        <h2 className="text-lg font-semibold">Prospect not found</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          This prospect request may have been removed or the ID is incorrect.
        </p>
      </div>
      <NavLink href="/discovery">
        <Button variant="outline">
          <ArrowLeft className="size-4" data-icon="inline-start" />
          Back to discovery flights
        </Button>
      </NavLink>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main detail component
// ---------------------------------------------------------------------------

interface ProspectDetailProps {
  prospectId: string;
}

export function ProspectDetail({ prospectId }: ProspectDetailProps) {
  const { data: prospect, isLoading, isError } = useProspectDetail(prospectId);

  if (isLoading) {
    return <ProspectDetailSkeleton />;
  }

  if (isError || !prospect) {
    return <ProspectNotFound />;
  }

  const createdAgo = formatDistanceToNow(new Date(prospect.createdAt), {
    addSuffix: true,
  });

  const preferredDateFormatted = prospect.preferredDate
    ? format(new Date(prospect.preferredDate + "T00:00:00"), "EEE, MMM d, yyyy")
    : null;

  return (
    <div
      className="flex flex-col gap-6 p-4 lg:p-6"
      data-testid="prospect-detail"
    >
      {/* Back link */}
      <NavLink
        href="/discovery"
        className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to discovery flights
      </NavLink>

      {/* Header */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <ProspectStatusBadge status={prospect.status} />
        </div>

        <h1 className="text-lg font-semibold leading-snug tracking-tight">
          {prospect.firstName} {prospect.lastName}
        </h1>

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
          <span>Submitted {createdAgo}</span>
        </div>
      </div>

      <Separator />

      {/* Status pipeline */}
      <section>
        <h2 className="mb-3 text-sm font-semibold">Status</h2>
        <StatusPipeline currentStatus={prospect.status} />
      </section>

      <Separator />

      {/* Preferences */}
      <section>
        <h2 className="mb-3 text-sm font-semibold">Preferences</h2>
        <div className="flex flex-col gap-2 rounded-md bg-muted/50 px-3 py-2">
          {preferredDateFormatted ? (
            <div className="flex items-center gap-2 text-xs">
              <Calendar className="size-3 text-muted-foreground" />
              <span className="font-medium">Preferred date:</span>
              <span>{preferredDateFormatted}</span>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              No date preference specified.
            </p>
          )}
          {prospect.preferredTimeOfDay && (
            <div className="flex items-center gap-2 text-xs">
              <Clock className="size-3 text-muted-foreground" />
              <span className="font-medium">Preferred time:</span>
              <span className="capitalize">{prospect.preferredTimeOfDay}</span>
            </div>
          )}
        </div>
      </section>

      {/* Linked proposal */}
      {prospect.linkedProposalId && (
        <>
          <Separator />
          <section>
            <h2 className="mb-3 text-sm font-semibold">Linked Proposal</h2>
            <NavLink
              href={`/proposals/${prospect.linkedProposalId}`}
              className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
            >
              <LinkIcon className="size-3.5" />
              View proposal {prospect.linkedProposalId}
            </NavLink>
          </section>
        </>
      )}
    </div>
  );
}
