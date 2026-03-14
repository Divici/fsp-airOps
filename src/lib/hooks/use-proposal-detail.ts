"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { ProposalDetailView } from "@/lib/types/proposal-detail";
import { apiFetch } from "@/lib/api/client";

export function useProposalDetail(proposalId: string) {
  return useQuery({
    queryKey: ["proposal", proposalId],
    queryFn: async () => {
      const data = await apiFetch<{ proposal: ProposalDetailView }>(
        `/api/proposals/${proposalId}`,
      );
      return data.proposal;
    },
    enabled: !!proposalId,
  });
}

export function useApproveProposal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (proposalId: string) => {
      await apiFetch(`/api/proposals/${proposalId}/approve`, {
        method: "POST",
      });
    },
    onSuccess: async (_data, proposalId) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["proposal", proposalId] }),
        queryClient.invalidateQueries({ queryKey: ["proposals"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard-metrics"] }),
        queryClient.invalidateQueries({ queryKey: ["recent-activity"] }),
        queryClient.invalidateQueries({ queryKey: ["audit-feed"] }),
      ]);
    },
  });
}

export function useDeclineProposal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      proposalId,
      reason,
    }: {
      proposalId: string;
      reason?: string;
    }) => {
      await apiFetch(`/api/proposals/${proposalId}/decline`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      });
    },
    onSuccess: async (_data, { proposalId }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["proposal", proposalId] }),
        queryClient.invalidateQueries({ queryKey: ["proposals"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard-metrics"] }),
        queryClient.invalidateQueries({ queryKey: ["recent-activity"] }),
        queryClient.invalidateQueries({ queryKey: ["audit-feed"] }),
      ]);
    },
  });
}
