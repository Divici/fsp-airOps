import { ApprovalQueue } from "@/components/proposals/approval-queue";

export default function DashboardPage() {
  return <ApprovalQueue title="Approval Queue" defaultStatus="pending" />;
}
