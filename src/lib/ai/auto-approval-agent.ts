// ---------------------------------------------------------------------------
// Auto-Approval Agent — AI-driven risk assessment with tool-calling loop
// Falls back to deterministic scoring on any error.
// ---------------------------------------------------------------------------

import { getOpenAIClient } from "./client";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { SCHEDULING_TOOLS } from "./tools/scheduling-tools";
import { ToolExecutor } from "./tools/tool-executor";
import {
  AUTO_APPROVAL_SYSTEM_PROMPT,
  buildUserPrompt,
} from "./prompts/auto-approval";
import { computeDeterministicScore } from "./deterministic-scorer";
import type {
  AutoApprovalContext,
  AutoApprovalDecision,
  ToolCallTrace,
} from "./types";
import type { IFspClient } from "@/lib/fsp-client";

const MAX_ITERATIONS = 5;

export class AutoApprovalAgent {
  constructor(private fspClient: IFspClient) {}

  async evaluate(context: AutoApprovalContext): Promise<AutoApprovalDecision> {
    try {
      const client = getOpenAIClient();
      const toolExecutor = new ToolExecutor(
        this.fspClient,
        context.operatorId,
        context,
      );
      const toolCallTraces: ToolCallTrace[] = [];

      const messages: ChatCompletionMessageParam[] = [
        { role: "system", content: AUTO_APPROVAL_SYSTEM_PROMPT },
        { role: "user", content: buildUserPrompt(context) },
      ];

      for (let i = 0; i < MAX_ITERATIONS; i++) {
        const response = await client.chat.completions.create({
          model: "gpt-4o",
          messages,
          tools: SCHEDULING_TOOLS,
          tool_choice: "auto",
          temperature: 0.3,
          max_tokens: 1000,
        });

        const choice = response.choices[0];
        const message = choice.message;

        // If no tool calls, this is the final response
        if (!message.tool_calls || message.tool_calls.length === 0) {
          messages.push(message);
          const content = message.content ?? "";
          try {
            const parsed = JSON.parse(content) as Record<string, unknown>;
            return {
              decision:
                parsed.decision === "approve" ? "approve" : "defer",
              confidence:
                typeof parsed.confidence === "number"
                  ? parsed.confidence
                  : 0.5,
              reasoning:
                typeof parsed.reasoning === "string"
                  ? parsed.reasoning
                  : "No reasoning provided",
              riskFactors: Array.isArray(parsed.riskFactors)
                ? (parsed.riskFactors as string[])
                : [],
              mitigations: Array.isArray(parsed.mitigations)
                ? (parsed.mitigations as string[])
                : [],
              toolCalls: toolCallTraces,
              method: "ai",
            };
          } catch {
            // If we can't parse JSON, fall back to deterministic
            return computeDeterministicScore(context);
          }
        }

        // Execute tool calls
        messages.push(message);
        for (const toolCall of message.tool_calls) {
          if (toolCall.type !== "function") continue;
          const start = Date.now();
          const args = JSON.parse(
            toolCall.function.arguments,
          ) as Record<string, unknown>;
          const result = await toolExecutor.execute(
            toolCall.function.name,
            args,
          );
          const durationMs = Date.now() - start;

          toolCallTraces.push({
            tool: toolCall.function.name,
            input: args,
            output: result as Record<string, unknown>,
            durationMs,
          });

          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify(result),
          });
        }
      }

      // Max iterations reached — fall back to deterministic
      return computeDeterministicScore(context);
    } catch {
      // Any error (no API key, network, etc.) — fall back to deterministic
      return computeDeterministicScore(context);
    }
  }
}
