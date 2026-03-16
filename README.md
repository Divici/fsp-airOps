# AirOps — AI Scheduling Optimization for Flight Schedule Pro

AirOps is a multi-tenant scheduling optimization console that integrates with [Flight Schedule Pro (FSP)](https://www.flightschedulepro.com/) to automate and optimize flight school scheduling. It monitors schedule state, detects opportunities and disruptions, generates AI-powered suggestions, and routes everything through a human approval queue.

## What It Does

Flight schools deal with constant schedule churn: cancellations, weather delays, students going inactive, new prospects requesting discovery flights. AirOps handles this automatically:

- **Reschedule on Cancellation** — Detects cancellations and generates compatible alternatives for the affected student
- **Discovery Flight Booking** — Processes prospect intake forms and generates available options respecting daylight and instructor constraints
- **Schedule Next Lesson** — After a lesson completes, suggests the next training event based on enrollment and availability
- **Waitlist Automation** — When openings emerge, ranks eligible candidates and proposes bookings
- **Inactive Student Outreach** — Detects students who haven't flown recently and generates personalized re-engagement proposals
- **Weather Disruption Adjustments** — Monitors weather conditions and reschedules affected flights when conditions drop below VFR minimums

## How AI Is Used

AirOps uses a hybrid approach: deterministic pipelines for detection and constraint-checking, with AI at three decision points where human-like judgment adds value:

| AI Feature | What It Does | Fallback |
|---|---|---|
| **Slot Ranker** | Ranks candidate time slots by student's historical booking patterns and preferences | Deterministic sort by instructor continuity + soonest available |
| **Outreach Message Generator** | Creates personalized, encouraging emails for inactive students | Standard template with variable substitution |
| **Flight Prioritizer** | Ranks weather-affected flights by urgency (checkride deadlines, training gaps) | Sort by days since last flight |
| **Auto-Approver** | Evaluates proposals for autonomous approval using a tool-calling agent with 6 scheduling tools | Deterministic confidence scorer |

Every AI feature degrades gracefully — the system works without OpenAI.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript 5.9 |
| Database | PostgreSQL + Drizzle ORM |
| Background Jobs | Inngest |
| UI | Shadcn/ui + Tailwind CSS 4 |
| Client State | TanStack React Query |
| AI | OpenAI GPT-4o |
| Email | SendGrid |
| SMS | Twilio |
| Testing | Vitest + Testing Library |

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm
- PostgreSQL 16

### Setup

```bash
# Install dependencies
pnpm install

# Copy environment variables
cp env.example .env.local
# Edit .env.local with your values (see Environment Variables below)

# Run database migrations
pnpm db:migrate

# Seed demo data
pnpm db:seed

# Start development server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). In mock mode, log in with any email/password.

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `NEXT_PUBLIC_APP_URL` | Yes | App URL (e.g., `http://localhost:3000`) |
| `FSP_ENVIRONMENT` | Yes | `mock` for development, `develop` for FSP integration |
| `FSP_SUBSCRIPTION_KEY` | For FSP | FSP API subscription key |
| `OPENAI_API_KEY` | For AI | Enables AI slot ranking, outreach messages, flight prioritization, and auto-approval |
| `SENDGRID_API_KEY` | For email | SendGrid API key for email notifications |
| `SENDGRID_FROM_EMAIL` | For email | Verified sender email address |
| `TWILIO_ACCOUNT_SID` | For SMS | Twilio account SID |
| `TWILIO_AUTH_TOKEN` | For SMS | Twilio auth token |
| `TWILIO_FROM_NUMBER` | For SMS | Twilio phone number |
| `SESSION_SECRET` | Production | 32+ character secret for JWT sessions |
| `INNGEST_EVENT_KEY` | For crons | Inngest event key |
| `INNGEST_SIGNING_KEY` | For crons | Inngest signing key |

## Scripts

```bash
pnpm dev            # Start development server
pnpm build          # Production build
pnpm start          # Start production server
pnpm test           # Run test suite
pnpm test:watch     # Run tests in watch mode
pnpm lint           # Run ESLint
pnpm typecheck      # Run TypeScript compiler check
pnpm db:generate    # Generate new migration from schema changes
pnpm db:migrate     # Apply pending migrations
pnpm db:studio      # Open Drizzle Studio (database browser)
pnpm db:seed        # Seed database with demo data
```

## Architecture

```
src/
  app/                    # Next.js App Router pages + API routes
    (dashboard)/          # Authenticated dashboard layout
    api/                  # REST API endpoints
    login/                # Auth pages
    book/[id]/            # Public discovery flight intake form
  lib/
    engine/               # Orchestration engine
      detection/          # Cancellation, inactivity, weather detectors
      workflows/          # 6 workflow handlers
      execution/          # Validate-then-create reservation executor
      auto-approver/      # AI tool-calling agent
      scheduling/         # Slot finding and ranking
      training/           # Next lesson resolution
      waitlist/           # Candidate finding and ranking
    ai/                   # AI features (slot ranker, outreach, prioritizer)
    fsp-client/           # FSP API client (interface + mock + real)
    weather/              # Weather service (interface + mock)
    comms/                # Email/SMS providers + templates
    db/                   # Drizzle schema, migrations, queries
    auth/                 # JWT sessions, tenant context
    observability/        # Structured logger, metrics, correlation
  components/             # React components
    proposals/            # Proposal queue, detail, approval
    discovery/            # Prospect list, detail, intake form
    dashboard/            # Metrics grid, recent activity
    settings/             # Operator configuration
    layout/               # Sidebar, header, navigation
```

## FSP Integration

AirOps uses an interface-driven FSP client (`IFspClient`) with 18 methods covering reservations, scheduling, resources, and availability. In development, a mock client returns realistic data. When FSP credentials are available, the real client activates via environment configuration — no code changes needed.

Key integration patterns:
- **Validate-then-create** for reservation execution
- **Snapshot comparison** for cancellation detection (cron every 5 minutes)
- **Find-a-Time** adapter for slot discovery
- **Rate limiting** at 55 requests/60 seconds

## Multi-Tenancy

Every record is scoped by `operatorId`. Each flight school operator has independent:
- Scheduling proposals and approval history
- Ranking weights and auto-approval thresholds
- Communication templates and preferences
- Feature flags and workflow toggles
- Audit trail

## Deployment

A 3-stage Dockerfile and `docker-compose.prod.yml` are included. A `railway.toml` is provided for Railway deployment.

```bash
# Docker
docker compose -f docker-compose.prod.yml up -d

# Or build directly
docker build -t fsp-airops .
```

## License

Proprietary. All rights reserved.
