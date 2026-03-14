# Tech Context: FSP Agentic Scheduler

## Stack
- Language: TypeScript 5.x
- Package Manager: pnpm
- Framework: Next.js (App Router)
- ORM: Drizzle
- Database: PostgreSQL (Docker Compose for local dev)
- AI Provider: OpenAI (GPT-4o for proposal assembly + rationale, with deterministic fallback)
- Background Jobs: Inngest (cron-based triggers for cancellation detection, lesson completion, proposal expiration)
- Test Runner: Vitest
- Linter: ESLint (Next.js config)
- Type Checker: TypeScript strict mode (`pnpm typecheck`)

## External Services
- **FSP API** (3 base URLs from env.example):
  - Auth/APIM gateway: `https://development-fsp.azure-api.net`
  - Core API: `https://api-develop.flightschedulepro.com`
  - Curriculum API: `https://curriculum-api-develop.flightschedulepro.com`
- **FSP auth**: Bearer token + `x-subscription-key` header
- **FSP public developer API**: READ-ONLY. Write endpoints (reservation creation, AutoSchedule, Find-a-Time) require internal API access.
- **OpenAI API**: Proposal assembly and rationale generation
- **SMS provider**: Interface stub (Twilio planned, not wired)
- **Email provider**: Interface stub (SendGrid planned, not wired)
- **Email (FSP-native)**: `sendEmailNotification` on reservation create

## FSP Client Status
- 18 typed methods defined across interfaces
- Mock implementations: fully functional, used in all tests and dev
- Real implementations: all 18 methods are stubs (`throw new Error("Not implemented")`) awaiting credentials
- Message sent to FSP technical contact requesting: subscription key, write API access, test operator

## Auth Status
- Mock mode only: middleware auto-injects `operatorId: 1` for all requests
- No real auth flow implemented yet

## Deployment
- Target: Azure (specific service TBD)
- Dev: Docker Compose (PostgreSQL)
- No CI/CD pipeline yet

## Project Structure
```
src/
├── app/                    # Next.js pages + API routes
│   ├── api/                # REST endpoints
│   │   ├── audit/          # GET /api/audit
│   │   ├── dashboard/      # GET /api/dashboard/metrics
│   │   ├── proposals/      # CRUD + batch approve/decline
│   │   ├── prospects/      # Discovery flight prospects
│   │   ├── settings/       # GET/PATCH + POST reset
│   │   └── triggers/       # Trigger dispatch
│   ├── book/[id]/          # Public discovery flight intake form
│   └── (dashboard)/        # Dashboard layout group
├── lib/
│   ├── fsp-client/         # Typed FSP API client + mock
│   ├── engine/             # Orchestration engine + workflows
│   ├── db/                 # Drizzle schema, migrations, queries
│   ├── auth/               # FSP auth integration (mock only)
│   ├── comms/              # Email/SMS services (interface stubs)
│   ├── ai/                 # OpenAI integration + deterministic fallback
│   ├── observability/      # Logger, correlation context, metrics collector
│   ├── feature-flags/      # Feature flag service
│   └── types/              # Shared types and Zod schemas
├── components/             # React components
│   ├── hooks/              # React Query hooks (wired to real APIs)
│   └── ui/                 # Reusable UI primitives
├── mappers/                # Server-side DB row → View type mappers
└── config/                 # App configuration
```

## API Endpoints
| Method | Path | Purpose |
|--------|------|---------|
| GET | /api/proposals | List proposals (with filters) |
| POST | /api/proposals/:id/approve | Approve + execute reservation |
| POST | /api/proposals/:id/decline | Decline proposal |
| POST | /api/proposals/batch/approve | Batch approve |
| POST | /api/proposals/batch/decline | Batch decline |
| GET | /api/prospects | List discovery prospects |
| POST | /api/prospects | Create prospect + dispatch trigger |
| GET | /api/settings | Get operator settings |
| PATCH | /api/settings | Update operator settings |
| POST | /api/settings/reset | Reset to defaults |
| GET | /api/audit | Audit feed |
| GET | /api/dashboard/metrics | Dashboard summary cards |
| POST | /api/triggers | Manual trigger dispatch |

## Constraints
- FSP is source of truth for reservations/resources — never cache authoritatively
- Reservation create uses local time (no TZ suffix), not UTC
- AutoSchedule solver returns UTC — convert using timeZoneOffset
- All data must be tenant-isolated by operatorId
- US data residency required
- Snapshot persistence is in-memory Map (lost on restart)
- Background jobs use Inngest cron (not queue-based)
