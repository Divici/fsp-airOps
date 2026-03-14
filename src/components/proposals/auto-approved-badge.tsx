import { Zap } from "lucide-react";
import { cn } from "@/lib/utils";

export function AutoApprovedBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
        className
      )}
    >
      <Zap className="size-3" />
      Auto
    </span>
  );
}
