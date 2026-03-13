import { ProposalDetail } from "@/components/proposals/proposal-detail";

interface ProposalDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function ProposalDetailPage({
  params,
}: ProposalDetailPageProps) {
  const { id } = await params;
  return <ProposalDetail proposalId={id} />;
}
