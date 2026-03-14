import { useState, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

// ---------------------------------------------------------------------------
// Mock batch operations — replaced with real API calls later
// ---------------------------------------------------------------------------

async function batchApproveProposals(ids: string[]): Promise<void> {
  await new Promise((r) => setTimeout(r, 600));
  void ids; // will send to API in real implementation
}

async function batchDeclineProposals(ids: string[]): Promise<void> {
  await new Promise((r) => setTimeout(r, 600));
  void ids; // will send to API in real implementation
}

// ---------------------------------------------------------------------------
// Selection state hook
// ---------------------------------------------------------------------------

export function useBatchSelection() {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback((ids: string[]) => {
    setSelectedIds(new Set(ids));
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const isSelected = useCallback(
    (id: string) => selectedIds.has(id),
    [selectedIds]
  );

  return {
    selectedIds,
    selectedCount: selectedIds.size,
    toggleSelect,
    selectAll,
    clearSelection,
    isSelected,
  };
}

// ---------------------------------------------------------------------------
// Batch mutation hooks
// ---------------------------------------------------------------------------

export function useBatchApprove() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ids: string[]) => batchApproveProposals(ids),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["proposals"] });
    },
  });
}

export function useBatchDecline() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ids: string[]) => batchDeclineProposals(ids),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["proposals"] });
    },
  });
}

// ---------------------------------------------------------------------------
// Combined hook
// ---------------------------------------------------------------------------

export function useBatchApproval() {
  const selection = useBatchSelection();
  const approveMutation = useBatchApprove();
  const declineMutation = useBatchDecline();

  const batchApprove = useCallback(
    (ids: string[]) => approveMutation.mutateAsync(ids),
    [approveMutation]
  );

  const batchDecline = useCallback(
    (ids: string[]) => declineMutation.mutateAsync(ids),
    [declineMutation]
  );

  return {
    ...selection,
    batchApprove,
    batchDecline,
    isApproving: approveMutation.isPending,
    isDeclining: declineMutation.isPending,
    isBatchOperating: approveMutation.isPending || declineMutation.isPending,
  };
}
