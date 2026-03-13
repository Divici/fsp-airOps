# Tech Context: FSP Agentic Scheduler

## Stack
- Language: TypeScript 5.x
- Package Manager: pnpm
- Framework: Next.js (App Router)
- ORM: Drizzle
- Database: PostgreSQL (Docker Compose for local dev)
- AI Provider: OpenAI (GPT-4o for proposal assembly + rationale)
- Test Runner: Vitest
- Linter: ESLint (Next.js config)
- Type Checker: TypeScript strict mode (`pnpm typecheck`)

## External Services
- **FSP API** (3 base URLs):
  - Auth/APIM gateway: `https://development-fsp.azure-api.net`
  - Core API: `https://api-develop.flightschedulepro.com`
  - Curriculum API: `https://curriculum-api-develop.flightschedulepro.com`
- **FSP auth**: Bearer token + `x-subscription-key` header
- **OpenAI API**: Proposal assembly and rationale generation
- **SMS provider**: TBD (abstracted service)
- **Email**: FSP-native email via `sendEmailNotification` on reservation create

## Deployment
- Target: Azure (specific service TBD)
- Dev: Docker Compose (PostgreSQL)

## Project Structure
```
src/
├── app/                    # Next.js pages + API routes
├── lib/
│   ├── fsp-client/         # Typed FSP API client + mock
│   ├── engine/             # Orchestration engine + workflows
│   ├── db/                 # Drizzle schema, migrations, queries
│   ├── auth/               # FSP auth integration
│   ├── comms/              # Email/SMS services
│   ├── ai/                 # OpenAI integration
│   └── types/              # Shared types and Zod schemas
├── components/             # React components
└── config/                 # App configuration
```

## Constraints
- FSP is source of truth for reservations/resources -- never cache authoritatively
- Reservation create uses local time (no TZ suffix), not UTC
- AutoSchedule solver returns UTC -- convert using timeZoneOffset
- All data must be tenant-isolated by operatorId
- US data residency required
- No FSP dev credentials yet -- mock-first development
- Background job execution model deferred (cron vs queue vs manual TBD)
