"use client";

import { Sparkles } from "lucide-react";

interface RationaleSectionProps {
  summary: string;
  rationale: string;
}

export function RationaleSection({ summary, rationale }: RationaleSectionProps) {
  return (
    <section
      data-testid="rationale-section"
      className="rounded-lg border border-primary/10 bg-primary/5 p-4"
    >
      <div className="mb-2 flex items-center gap-1.5">
        <Sparkles className="size-3.5 text-primary/60" />
        <span className="text-xs font-medium text-primary/70">
          AI-generated rationale
        </span>
      </div>
      <p className="text-sm font-medium leading-snug text-foreground">
        {summary}
      </p>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
        {rationale}
      </p>
    </section>
  );
}
