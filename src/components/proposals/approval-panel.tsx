"use client";

import { useState } from "react";
import { Check, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "./status-badge";
import {
  useApproveProposal,
  useDeclineProposal,
} from "@/lib/hooks/use-proposal-detail";
import type { ProposalStatus } from "@/lib/types/domain";

interface ApprovalPanelProps {
  proposalId: string;
  status: ProposalStatus;
}

export function ApprovalPanel({ proposalId, status }: ApprovalPanelProps) {
  const [approveOpen, setApproveOpen] = useState(false);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState("");

  const approveMutation = useApproveProposal();
  const declineMutation = useDeclineProposal();

  const isPending = status === "pending";

  function handleApprove() {
    approveMutation.mutate(proposalId, {
      onSuccess: () => {
        setApproveOpen(false);
        toast.success("Proposal approved", {
          description: "The reservation will be created in FSP.",
        });
      },
      onError: () => {
        toast.error("Failed to approve proposal", {
          description: "Please try again or contact support.",
        });
      },
    });
  }

  function handleDecline() {
    declineMutation.mutate(
      { proposalId, reason: declineReason || undefined },
      {
        onSuccess: () => {
          setDeclineOpen(false);
          setDeclineReason("");
          toast.success("Proposal declined");
        },
        onError: () => {
          toast.error("Failed to decline proposal", {
            description: "Please try again or contact support.",
          });
        },
      }
    );
  }

  if (!isPending) {
    return (
      <div
        data-testid="approval-panel-resolved"
        className="flex items-center gap-2 rounded-lg border bg-muted/30 p-4"
      >
        <span className="text-sm text-muted-foreground">
          This proposal has been
        </span>
        <StatusBadge status={status} />
      </div>
    );
  }

  return (
    <div
      data-testid="approval-panel"
      className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="text-sm font-medium">Review this proposal</p>
      <div className="flex gap-2">
        {/* Approve */}
        <Dialog open={approveOpen} onOpenChange={setApproveOpen}>
          <DialogTrigger
            render={
              <Button
                size="lg"
                className="bg-green-600 text-white hover:bg-green-700 dark:bg-green-600 dark:hover:bg-green-700"
              />
            }
          >
            <Check className="size-4" data-icon="inline-start" />
            Approve
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Approve Proposal</DialogTitle>
              <DialogDescription>
                This will create a reservation in Flight Schedule Pro. Are you
                sure you want to proceed?
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setApproveOpen(false)}
                disabled={approveMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                onClick={handleApprove}
                disabled={approveMutation.isPending}
                className="bg-green-600 text-white hover:bg-green-700 dark:bg-green-600 dark:hover:bg-green-700"
              >
                {approveMutation.isPending && (
                  <Loader2 className="size-4 animate-spin" data-icon="inline-start" />
                )}
                Confirm Approval
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Decline */}
        <Dialog open={declineOpen} onOpenChange={setDeclineOpen}>
          <DialogTrigger render={<Button size="lg" variant="destructive" />}>
            <X className="size-4" data-icon="inline-start" />
            Decline
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Decline Proposal</DialogTitle>
              <DialogDescription>
                Optionally provide a reason for declining. This helps improve
                future suggestions.
              </DialogDescription>
            </DialogHeader>
            <Textarea
              placeholder="Reason for declining (optional)..."
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              rows={3}
            />
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDeclineOpen(false)}
                disabled={declineMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDecline}
                disabled={declineMutation.isPending}
              >
                {declineMutation.isPending && (
                  <Loader2 className="size-4 animate-spin" data-icon="inline-start" />
                )}
                Confirm Decline
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
