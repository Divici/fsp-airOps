import { ProspectDetail } from "@/components/discovery/prospect-detail";

interface ProspectDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function ProspectDetailPage({
  params,
}: ProspectDetailPageProps) {
  const { id } = await params;
  return <ProspectDetail prospectId={id} />;
}
