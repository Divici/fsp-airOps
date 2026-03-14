"use client";

import { useState } from "react";
import { Check, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface BatchActionsProps {
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onBatchApprove: () => Promise<void>;
  onBatchDecline: () => Promise<void>;
  isApproving: boolean;
  isDeclining: boolean;
  allSelected: boolean;
}

export function BatchActions({
  selectedCount,
  totalCount,
  onSelectAll,
  onClearSelection,
  onBatchApprove,
  onBatchDecline,
  isApproving,
  isDeclining,
  allSelected,
}: BatchActionsProps) {
  const [approveOpen, setApproveOpen] = useState(false);
  const [declineOpen, setDeclineOpen] = useState(false);

  const isBusy = isApproving || isDeclining;

  async function handleBatchApprove() {
    try {
      await onBatchApprove();
      setApproveOpen(false);
      toast.success(`${selectedCount} proposal${selectedCount !== 1 ? "s" : ""} approved`);
    } catch {
      toast.error("Failed to approve proposals");
    }
  }

  async function handleBatchDecline() {
    try {
      await onBatchDecline();
      setDeclineOpen(false);
      toast.success(`${selectedCount} proposal${selectedCount !== 1 ? "s" : ""} declined`);
    } catch {
      toast.error("Failed to decline proposals");
    }
  }

  if (selectedCount === 0 && totalCount === 0) return null;

  return (
    <div
      className="flex items-center gap-3 rounded-lg border bg-muted/30 px-3 py-2"
      data-testid="batch-actions"
    >
      {/* Select all checkbox */}
      <label className="flex items-center gap-2 cursor-pointer">
        <Checkbox
          checked={allSelected && totalCount > 0}
          onCheckedChange={(checked) => {
            if (checked) {
              onSelectAll();
            } else {
              onClearSelection();
            }
          }}
          disabled={totalCount === 0 || isBusy}
        />
        <span className="text-xs font-medium">Select All</span>
      </label>

      {/* Count display */}
      <span className="text-xs text-muted-foreground">
        {selectedCount} of {totalCount} selected
      </span>

      {/* Action buttons */}
      {selectedCount > 0 && (
        <div className="ml-auto flex items-center gap-2">
          {/* Batch Approve */}
          <Dialog open={approveOpen} onOpenChange={setApproveOpen}>
            <DialogTrigger
              render={
                <Button
                  size="sm"
                  className="bg-green-600 text-white hover:bg-green-700 dark:bg-green-600 dark:hover:bg-green-700"
                  disabled={isBusy}
                />
              }
            >
              <Check className="size-3.5" data-icon="inline-start" />
              Approve ({selectedCount})
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Batch Approve</DialogTitle>
                <DialogDescription>
                  This will approve {selectedCount} proposal
                  {selectedCount !== 1 ? "s" : ""}. Reservations will be created
                  in Flight Schedule Pro. Are you sure?
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setApproveOpen(false)}
                  disabled={isApproving}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleBatchApprove}
                  disabled={isApproving}
                  className="bg-green-600 text-white hover:bg-green-700 dark:bg-green-600 dark:hover:bg-green-700"
                >
                  {isApproving && (
                    <Loader2 className="size-4 animate-spin" data-icon="inline-start" />
                  )}
                  Confirm Approval
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Batch Decline */}
          <Dialog open={declineOpen} onOpenChange={setDeclineOpen}>
            <DialogTrigger
              render={
                <Button size="sm" variant="destructive" disabled={isBusy} />
              }
            >
              <X className="size-3.5" data-icon="inline-start" />
              Decline ({selectedCount})
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Batch Decline</DialogTitle>
                <DialogDescription>
                  This will decline {selectedCount} proposal
                  {selectedCount !== 1 ? "s" : ""}. Are you sure?
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setDeclineOpen(false)}
                  disabled={isDeclining}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleBatchDecline}
                  disabled={isDeclining}
                >
                  {isDeclining && (
                    <Loader2 className="size-4 animate-spin" data-icon="inline-start" />
                  )}
                  Confirm Decline
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )}
    </div>
  );
}
