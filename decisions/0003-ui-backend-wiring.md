# 0003: UI-to-Backend Wiring Architecture

**Date:** 2026-03-14
**Status:** implemented

## Context
The app had a fully implemented backend (API routes, DB queries, workflow engine, executor) but the UI used hardcoded mock data in 7 React Query hooks. The only real connection was the discovery intake form. Approving a proposal did nothing. This decision covers the architecture choices made to wire the frontend to the real backend.

## Decision

### 1. Server-side mappers vs client-side transformation
**Chose server-side mappers in API routes.** The database stores raw IDs (studentId, locationId) but the UI needs display names. The FSP client that resolves IDs to names is server-only. Mappers batch-fetch all referenced resources once per request and resolve names from a cache map.

**Tradeoff:** Adds FSP API calls to every list request. Mitigated by batching lookups per request rather than per row.

### 2. Inline execution vs async (Inngest) execution on approval
**Chose inline execution in the approve endpoint.** Simpler UX — the approve button's loading state covers the entire validate-then-create flow. No need for polling or websockets to show the execution result.

**Tradeoff:** The approve request takes longer (validate + create reservation). Acceptable for MVP since mock FSP is fast. May need to move to async for real FSP if latency is high.

### 3. UI terminology: "Approved" instead of "Executed"
**Chose to rename "Executed" → "Approved" in all user-facing surfaces.** Dispatchers think in terms of their action (approval), not the system's internal state (execution). "Failed" is shown separately for stuck proposals.

### 4. await invalidateQueries in mutation onSuccess
**Chose to await all invalidations so the mutation stays in isPending state.** This prevents the gap where the user sees "success" but the data hasn't refreshed yet. Dashboard metrics, proposal list, and activity feed all update before the loading spinner stops.

### 5. Discovery prospect lifecycle management
**Chose to auto-advance prospect status in the API endpoints, not in the workflow engine.** The workflow engine is stateless — it takes a trigger context and returns proposed actions. Linking proposals back to prospects is an API-layer concern. The approve endpoint traces proposal → trigger → prospect to advance status.

## Consequences
- Every list endpoint pays the cost of FSP resource resolution; caching or a denormalized name column may be needed at scale
- Inline approval keeps MVP simple but creates a coupling between approve latency and FSP API latency
- "Approved" terminology aligns with dispatcher mental model, reducing confusion in the UI
- Awaited query invalidation provides a seamless data-refresh experience at the cost of slightly longer perceived mutation time
- Prospect lifecycle logic lives in the API layer, keeping the workflow engine purely functional and stateless

## Alternatives Considered
- **Client-side ID resolution** — rejected; FSP client is server-only and exposing it to the browser would leak API keys
- **Inngest async execution on approval** — deferred, not rejected; will revisit if real FSP latency makes inline execution too slow
- **Optimistic updates instead of awaited invalidation** — rejected for MVP; optimistic logic is error-prone when the approve call can fail validation
- **Workflow engine managing prospect status** — rejected; breaks the engine's stateless design and mixes orchestration with data lifecycle
