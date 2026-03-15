# 0005: Phase 2 AI Strategy — Where AI Adds Value vs. Deterministic Logic

**Date:** 2026-03-15
**Status:** accepted

## Context

Phase 2 introduces two new features (inactive student outreach, weather disruptions) and three cross-cutting AI enhancements. FSP wants AI involvement where it genuinely adds value. We need to decide where AI is worth the cost/latency vs. where deterministic logic is faster and more reliable.

## Decision

### Hybrid approach: deterministic pipelines with AI at decision points

The overall pipeline for both features is deterministic (detection → slot finding → proposal creation). AI is injected at three specific points where human-like judgment adds measurable value over rules:

### 1. AI Slot Ranker — ranking candidate time slots by student preferences

**Chose AI over deterministic ranking.**

A deterministic ranker can sort by instructor continuity and soonest-available. But it can't detect patterns like "this student always books Tuesday mornings" or "this student switched instructors after a failed checkride and should stay with the new one." The AI sees the full booking history and makes a judgment call.

**Alternative rejected:** Pure weighted scoring. Weights can't capture temporal patterns or contextual reasoning. A student who flew 3x/week for 2 months then stopped is different from one who always flew 1x/week — weights treat them the same.

**Fallback:** Deterministic sort (instructor continuity + soonest) when OpenAI is unavailable.

### 2. AI Outreach Message Generator — personalized student communication

**Chose AI over templates.**

A template says "It's been X days since your last flight." AI says "Hi Dave, it's been 12 days since your last flight and your Stage 3 checkride is just around the corner — let's get you back in the air with Sarah Chen this Tuesday morning." The personalization drives higher engagement and acceptance rates.

**Alternative rejected:** Template-only with variable substitution. Functional but generic. The outreach use case specifically benefits from warm, motivational tone that adapts to student context.

**Fallback:** Standard mustache template from `templates.ts` when OpenAI is unavailable.

### 3. AI Flight Prioritizer — ranking weather-affected flights by urgency

**Chose AI over simple sorting.**

When weather grounds 8 flights, a dispatcher decides which students to reschedule first based on nuanced factors: checkride deadlines, training gaps, instructor availability later in the day, whether the student can do sim time instead. The AI approximates this judgment.

**Alternative rejected:** Sort by days-since-last-flight. Misses critical context — a student 2 days from a checkride who flew yesterday is higher priority than a casual student who hasn't flown in 2 weeks.

**Fallback:** Sort by days-since-last-flight descending (most inactive = highest priority).

## Consequences

**Positive:**
- AI is used only where it provides measurable uplift over rules
- All AI features have deterministic fallbacks — system works without OpenAI
- Cost per workflow execution: ~$0.01-0.03 (small context windows, structured output)
- Same integration pattern as existing auto-approver (proven, tested)

**Negative:**
- Three new OpenAI call sites increase per-proposal latency by ~1-3 seconds
- Need to monitor AI output quality — personalized messages could occasionally be awkward
- OpenAI cost scales linearly with operator count (mitigated by cron frequency controls)

## Tradeoffs

| Concern | Mitigation |
|---------|-----------|
| AI latency | AI calls happen during background Inngest processing, not in the approval UI path |
| AI cost | Small context windows (~500-1000 tokens). Cron frequency is configurable per operator. |
| AI quality | Structured output schemas constrain responses. Fallbacks ensure degraded-but-functional behavior. |
| AI reliability | Every AI call has a deterministic fallback. System never blocks on OpenAI. |
