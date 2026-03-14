# System Patterns: FSP Agentic Scheduler

## Architecture Overview
Single Next.js application with organized internal modules. Hybrid AI + deterministic architecture where deterministic logic owns scheduling correctness and AI owns orchestration, proposal assembly, and explainability.

```
Frontend (Next.js App Router)
  └── Backend API (Next.js API Routes)
        ├── Orchestration Engine (src/lib/engine/)
        │     ├── Trigger detection + workflow resolution
        │     ├── Deterministic scheduling via FSP APIs
        │     └── AI proposal assembly + rationale
        ├── FSP Integration Layer (src/lib/fsp-client/)
        ├── Database Layer (src/lib/db/ -- Drizzle + PostgreSQL)
        ├── Auth (src/lib/auth/ -- FSP auth integration)
        ├── Observability (src/lib/observability/ -- logger, correlation, metrics)
        └── Communications (src/lib/comms/ -- email/SMS stubs)
```

## Key Components
- **Approval Queue** — central operator workspace, queue-first dashboard
- **Proposal Model** — represents a scheduling recommendation with rationale, affected entities, validation status
- **Orchestration Engine** — unified engine for all four workflows (not four separate pipelines)
- **Workflow Registry** — maps trigger types to workflow handlers; new workflows register without touching engine core
- **FSP Client** — typed wrappers around FSP APIs with mock implementations for dev/test
- **Tenant Context** — every operation scoped by operatorId
- **Server-side Mappers** — transform DB rows into View types with FSP name resolution (proposal, prospect, audit mappers)
- **React Query Hooks** — 7 hooks wired to real API endpoints for all UI data fetching and mutations

## Design Decisions
See `decisions/` directory for detailed ADRs.

## Patterns in Use

### Validate-then-create
All reservation creation goes through FSP validate endpoint before create. Two-step process prevents invalid reservations from reaching FSP.

### Mock-first FSP integration
Typed interfaces with mock implementations. Real FSP integration layered on top. All 18 client methods have mock versions; real versions are stubs awaiting credentials.

### Tenant-scoped everything
operatorId on every record, every query filtered by tenant. Middleware injects tenant context (mock: always operatorId 1).

### Source of truth boundary
FSP owns reservations/resources. This app owns proposals, audit logs, settings, prospects. Never cache FSP data authoritatively.

### Server-side mapper pattern
DB rows are not sent directly to the frontend. Mapper functions in `src/mappers/` transform DB rows into View types, resolving FSP entity names (student names, aircraft names, instructor names) via the FSP client. This keeps the API response shape stable even if the DB schema changes.

### Await invalidateQueries pattern
After mutations (approve, decline, batch operations), the mutation handler `await`s `queryClient.invalidateQueries()` before resolving. This keeps the UI in a loading state until fresh data arrives, preventing stale data flashes. Without the `await`, React Query resolves the mutation immediately and the UI briefly shows old data.

### Trigger → Workflow dispatch
TriggerService receives events (cancellation detected, lesson completed, prospect created, opening detected), deduplicates them, resolves the correct workflow via the registry, and dispatches. The trigger carries context (e.g., studentId, slotStart) that the workflow uses to generate proposals.

### Cron-based detection
Inngest cron jobs poll for state changes (cancelled reservations, completed lessons, expired proposals) rather than relying on webhooks. This is simpler and works without FSP webhook support.

### AI with deterministic fallback
OpenAI generates human-readable rationale for proposals. If OpenAI is unavailable or errors, a deterministic template-based fallback produces the rationale. Scheduling logic itself is always deterministic — AI only explains, never decides.

### Feature flags
Feature flag service gates new functionality. Flags can be toggled per-operator. Used for phased rollout of workflows.

### Post-approval execution
When a proposal is approved, the approval endpoint calls ReservationExecutor synchronously. The executor runs validate-then-create against FSP. If execution fails, the proposal stays in approved state with an error recorded.
