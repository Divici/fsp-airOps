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
    onSuccess: (_data, proposalId) => {
      void queryClient.invalidateQueries({
        queryKey: ["proposal", proposalId],
      });
      void queryClient.invalidateQueries({ queryKey: ["proposals"] });
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
    onSuccess: (_data, { proposalId }) => {
      void queryClient.invalidateQueries({
        queryKey: ["proposal", proposalId],
      });
      void queryClient.invalidateQueries({ queryKey: ["proposals"] });
    },
  });
}
