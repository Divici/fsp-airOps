import { FileText } from "lucide-react";

export default function DashboardPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
      <FileText className="size-10 opacity-40" />
      <p className="text-sm font-medium">No pending proposals</p>
    </div>
  );
}
