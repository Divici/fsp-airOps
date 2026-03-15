# 0004: Autonomous Auto-Approver Design

**Date:** 2026-03-14
**Status:** implemented

## Context
The PRD Phase 2 calls for increasing autonomy — moving beyond suggest-and-approve toward automated decision-making where appropriate. The goal is to reduce dispatcher workload for routine, high-confidence proposals while preserving human oversight for edge cases.

The auto-approver needs to provide meaningful AI value (not just a rules engine) while being safe, cost-effective, and resilient to OpenAI outages. It must work per-operator, since different flight schools have different risk tolerances.

## Decision

### 1. Tool-calling agent vs simple weighted scorer
**Chose a tool-calling agent (OpenAI gpt-4o) with 6 scheduling tools.**

The agent receives a proposal context and can call tools to gather additional information: check slot availability, verify instructor qualifications, look up student flight history, review weather conditions, check aircraft maintenance status, and validate scheduling constraints. It reasons through the proposal and returns a confidence score with an explanation.

A simple weighted scorer (sum heuristic signals like "same instructor = +0.2, morning slot = +0.1") was rejected because it cannot handle nuanced cases. For example, a scorer can't reason about whether a student who just failed a checkride should be paired with a different instructor for a fresh perspective. The tool-calling approach lets the agent gather exactly the information it needs, similar to how a human dispatcher would investigate before approving.

A ReAct loop (reason-act-observe cycle with free-form tool use) was considered but rejected. ReAct is harder to constrain, more expensive per evaluation (more LLM calls), and harder to test deterministically.

**Tradeoff:** Requires an OpenAI API key. Each evaluation costs ~$0.01-0.03. Adds 2-5 seconds of latency per evaluation.

### 2. Async via Inngest vs synchronous evaluation
**Chose asynchronous evaluation via Inngest.**

When a proposal is generated, if the operator has auto-approval enabled, an Inngest function fires in the background. The proposal appears as "pending" in the UI immediately. The agent evaluates asynchronously, and if the confidence score exceeds the operator's threshold, the proposal transitions to "approved" in the background.

Synchronous evaluation (blocking proposal creation until the agent finishes) was rejected because it would increase proposal creation latency from <1 second to 3-8 seconds. Dispatchers would perceive the system as slow, even though the delay is from the AI evaluation, not from scheduling logic.

**Tradeoff:** There is a brief window (2-5 seconds) where a proposal shows as "pending" even though it will be auto-approved. A dispatcher could manually approve it during this window (harmless — the agent checks the proposal's current status before acting and skips if already approved).

### 3. Deterministic fallback when OpenAI is unavailable
**Chose to include a rule-based deterministic fallback.**

If the OpenAI API call fails (timeout, rate limit, missing key, server error), the system falls back to a deterministic scorer that evaluates the same criteria using hard-coded rules and weights. The fallback produces a confidence score but without natural language reasoning.

The alternative — simply skipping auto-approval when OpenAI is down — was rejected because it would cause silent degradation. Operators who rely on auto-approval would see proposals pile up in the "pending" queue without understanding why.

**Tradeoff:** The deterministic fallback produces lower-quality evaluations (no nuanced reasoning). It may approve or reject proposals that the AI agent would have handled differently. But it keeps the system operational.

### 4. Per-operator configuration
**Chose per-operator toggle and confidence threshold.**

Each operator can: (a) enable or disable auto-approval entirely, and (b) set a confidence threshold (e.g., 0.85 = only auto-approve when the agent is 85%+ confident). This respects different risk tolerances — a large school with experienced dispatchers might set 0.70, while a small school might set 0.95 or disable it entirely.

## Consequences
- Auto-approver requires an OpenAI API key in production (new operational dependency)
- Inngest dependency expands from cron jobs (cancellation detection, proposal expiration) to include auto-approval evaluation
- Cost scales linearly with proposal volume (~$0.01-0.03 per evaluation)
- Deterministic fallback ensures the system degrades gracefully during OpenAI outages
- Per-operator config adds a new settings surface but gives operators control over their autonomy level
- The 2-5 second async window creates a race condition with manual approval, but the outcome is always safe (double-approval is prevented by checking status before acting)

## Alternatives Considered
- **Simple weighted scorer only** — rejected; insufficient for nuanced scheduling decisions, doesn't deliver the "AI value" that differentiates the product
- **ReAct loop** — rejected; harder to constrain, more expensive, harder to test deterministically
- **Synchronous evaluation** — rejected; 3-8 second latency on proposal creation is unacceptable for UX
- **Skip auto-approval on OpenAI failure** — rejected; causes silent degradation for operators who depend on auto-approval
- **Global (not per-operator) threshold** — rejected; different flight schools have different risk tolerances and operational patterns
