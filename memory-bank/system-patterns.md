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
        └── Communications (src/lib/comms/ -- email/SMS)
```

## Key Components
- **Approval Queue** -- central operator workspace, queue-first dashboard
- **Proposal Model** -- represents a scheduling recommendation with rationale, affected entities, validation status
- **Orchestration Engine** -- unified engine for all four workflows (not four separate pipelines)
- **FSP Client** -- typed wrappers around FSP APIs with mock implementations for dev/test
- **Tenant Context** -- every operation scoped by operatorId

## Design Decisions
See `decisions/` directory for detailed ADRs.

## Patterns in Use
- **Validate-then-create** -- all reservation creation goes through FSP validate endpoint before create
- **Mock-first FSP integration** -- typed interfaces with mock implementations, real FSP integration layered on top
- **Tenant-scoped everything** -- operatorId on every record, every query filtered by tenant
- **Source of truth boundary** -- FSP owns reservations/resources, this app owns proposals/audit/settings
