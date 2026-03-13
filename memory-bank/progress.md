# Progress: FSP Agentic Scheduler

## Completed
- [x] Project bootstrapping
- [x] Development workflow setup (.claude/, skills, hooks)
- [x] Memory bank initialized
- [x] Decision log initialized
- [x] Stack decisions locked (pnpm, Next.js, Drizzle, PostgreSQL, OpenAI, Vitest)

## In Progress
Nothing -- ready for first implementation task

## Not Started
### Foundation
- [ ] Next.js project scaffold (pnpm init, dependencies, config)
- [ ] Docker Compose for PostgreSQL
- [ ] Drizzle schema for app-owned entities
- [ ] Typed FSP API client interfaces + mock implementations
- [ ] FSP auth integration skeleton
- [ ] Audit/event framework

### Workflow A: Reschedule on Cancellation (anchor)
- [ ] Trigger detection for cancellations
- [ ] Find-a-Time integration for alternative slots
- [ ] Proposal generation model
- [ ] Approval queue UI
- [ ] Validate-then-create reservation execution
- [ ] Notification after approval

### Workflow B: Discovery Flight Booking
- [ ] Public intake form
- [ ] Prospect request model
- [ ] Slot generation for discovery flights
- [ ] Scheduler review + approval flow

### Workflow C: Schedule Next Lesson
- [ ] Training progress / enrollment data integration
- [ ] Next schedulable event derivation
- [ ] Scheduling option generation

### Workflow D: Waitlist Automation
- [ ] Candidate search and eligibility
- [ ] Configurable ranking weights
- [ ] Proposal grouping
- [ ] Operator settings UI for weights

### Cross-Cutting
- [ ] Operator settings persistence + UI
- [ ] Activity/audit feed UI
- [ ] SMS service abstraction
- [ ] Observability (logging, metrics)
- [ ] Feature flags for phased rollout

## Known Issues
- No FSP dev credentials -- building mock-first
- Background job execution model not yet decided

## Test Count
0 tests
