# Active Context: FSP Agentic Scheduler

## Current Phase
All non-credential-blocked work is complete. MVP is feature-complete with auth, CI/CD, comms, metrics, batch reservations, custom weights, and editable templates. Awaiting FSP dev credentials for real integration.

## Active Plan
See `memory-bank/plans/phase2-features-plan.md` — Inactive student outreach + weather disruptions + 3 AI value-adds.

## Just Completed
- Phase 1-6: Full MVP implementation (see plan for details)
- UI Wiring Session: All hooks wired to real APIs
- Pre-Credentials Hardening: Auto-approver, seed script, RealFspClient, rate limiter, snapshot persistence

### Non-Blocked Features Build (latest)
- **CI/CD Pipeline**: GitHub Actions CI, Dockerfile (3-stage node:20-alpine), docker-compose.prod.yml
- **Metrics Export**: Prometheus-format endpoint at GET /api/metrics (+ JSON mode)
- **Communication Providers**: SendGrid email + Twilio SMS with graceful fallback, wired into approval + auto-approval flows
- **Auth Integration**: Login page, JWT sessions (jose), operator selector, 4 auth API routes, middleware enforcement, sidebar logout
- **Batch Reservations**: batchCreateReservations + getBatchStatus on IFspClient, mock + real, executor batch mode with polling
- **Custom Waitlist Weights**: customWeights jsonb, ranker integration with signal mapping, settings UI
- **Operator-Editable Templates**: communicationTemplates jsonb, getTemplateForOperator(), template editor with live preview

## Quality Gates
- 618 tests passing across 53 test files
- Zero typecheck errors, zero lint violations
- All 4 workflows tested end-to-end against mock FSP data

## What's Next
1. **FSP Real Integration** — waiting on dev credentials (subscription key, write API access, test operator)
2. **Real API testing** — validate RealFspClient against live FSP endpoints
3. **Communication credentials** — SendGrid API key + Twilio account (providers gracefully fall back until configured)
4. **Deployment** — Azure setup (CI/Dockerfile ready, need Azure subscription)

## Active Decisions
- See decisions/0001-project-bootstrap.md for stack choices
- See decisions/0002-technology-choices.md for technology selections
- See decisions/0003-ui-backend-wiring.md for UI wiring architecture
- See decisions/0004-autonomous-auto-approver.md for auto-approver design
- Background jobs: Inngest (decided, replaces deferred status)

## Blockers
- Waiting on FSP tech contact for: subscription key, write API access, test operator
- FSP public developer API is READ-ONLY; write endpoints (reservation creation, AutoSchedule, Find-a-Time) require internal API access
- SendGrid/Twilio credentials needed for real notification delivery
