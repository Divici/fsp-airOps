"use client";

import { useState } from "react";
import {
  Brain,
  ChevronDown,
  ChevronRight,
  Shield,
  AlertTriangle,
} from "lucide-react";

export interface RiskAssessmentData {
  autoApproved: boolean;
  decision: {
    decision: string;
    confidence: number;
    reasoning: string;
    riskFactors: string[];
    mitigations: string[];
    method: string;
  };
  toolCalls: Array<{
    tool: string;
    input: Record<string, unknown>;
    output: Record<string, unknown>;
    durationMs: number;
  }>;
  threshold: number;
  evaluatedAt: string;
}

interface RiskAssessmentSectionProps {
  data: RiskAssessmentData;
}

function ConfidenceBar({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);
  const color =
    pct >= 80
      ? "bg-green-500"
      : pct >= 60
        ? "bg-amber-500"
        : "bg-red-500";

  return (
    <div className="flex items-center gap-2">
      <div className="h-2 flex-1 rounded-full bg-muted">
        <div
          className={`h-2 rounded-full ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-medium tabular-nums">{pct}%</span>
    </div>
  );
}

function ToolCallItem({
  call,
}: {
  call: RiskAssessmentData["toolCalls"][number];
}) {
  const inputSummary = Object.entries(call.input)
    .slice(0, 3)
    .map(([k, v]) => `${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`)
    .join(", ");

  return (
    <div className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2 text-xs">
      <div className="min-w-0 flex-1">
        <span className="font-medium">{call.tool}</span>
        {inputSummary && (
          <span className="ml-2 text-muted-foreground">{inputSummary}</span>
        )}
      </div>
      <span className="ml-2 flex-shrink-0 tabular-nums text-muted-foreground">
        {call.durationMs}ms
      </span>
    </div>
  );
}

export function RiskAssessmentSection({ data }: RiskAssessmentSectionProps) {
  const [toolCallsOpen, setToolCallsOpen] = useState(false);
  const { decision } = data;

  return (
    <section className="flex flex-col gap-4" data-testid="risk-assessment">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Brain className="size-5 text-purple-600 dark:text-purple-400" />
        <h2 className="text-sm font-semibold">AI Risk Assessment</h2>
      </div>

      {/* Decision badge */}
      <div className="flex flex-wrap items-center gap-2">
        {data.autoApproved ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-300">
            <Shield className="size-3" />
            Auto-Approved
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
            <AlertTriangle className="size-3" />
            Deferred to Human
          </span>
        )}
        <span className="text-xs text-muted-foreground">
          Method: {decision.method}
        </span>
      </div>

      {/* Confidence bar */}
      <div>
        <p className="mb-1 text-xs font-medium text-muted-foreground">
          Confidence
        </p>
        <ConfidenceBar confidence={decision.confidence} />
      </div>

      {/* Reasoning */}
      <div>
        <p className="mb-1 text-xs font-medium text-muted-foreground">
          Reasoning
        </p>
        <p className="text-sm leading-relaxed text-foreground">
          {decision.reasoning}
        </p>
      </div>

      {/* Risk factors */}
      {decision.riskFactors.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">
            Risk Factors
          </p>
          <ul className="list-inside list-disc space-y-0.5 text-sm text-foreground">
            {decision.riskFactors.map((factor, i) => (
              <li key={i}>{factor}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Mitigations */}
      {decision.mitigations.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">
            Mitigations
          </p>
          <ul className="list-inside list-disc space-y-0.5 text-sm text-foreground">
            {decision.mitigations.map((mitigation, i) => (
              <li key={i}>{mitigation}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Tool calls (collapsible) */}
      {data.toolCalls.length > 0 && (
        <div>
          <button
            type="button"
            className="flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            onClick={() => setToolCallsOpen((prev) => !prev)}
          >
            {toolCallsOpen ? (
              <ChevronDown className="size-3" />
            ) : (
              <ChevronRight className="size-3" />
            )}
            Tool Calls ({data.toolCalls.length})
          </button>
          {toolCallsOpen && (
            <div className="mt-2 flex flex-col gap-1">
              {data.toolCalls.map((call, i) => (
                <ToolCallItem key={i} call={call} />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
