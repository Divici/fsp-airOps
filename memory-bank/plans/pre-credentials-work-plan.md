# Pre-Credentials Work Plan

Remaining work that is NOT blocked on FSP credentials. Prioritized by impact.

---

## Phase A: Functional Gaps (High Priority)

### A.1 — Test Waitlist Workflow
The only MVP workflow not yet tested end-to-end.
- POST to `/api/triggers/evaluate` or create an opening detection trigger
- Verify candidate ranking, proposal generation, and approval flow
- Fix any context mapping issues (like we found with cancellation and lesson-completion)

### A.2 — Verify Settings Persistence
- Go to `/settings`, change ranking weights and toggles
- Refresh the page, confirm values persisted
- Fix any issues found

### A.3 — Seed Script (`pnpm db:seed`)
Create `src/scripts/seed.ts` that populates:
- 1 operator settings record (operatorId: 1)
- 3-5 scheduling triggers across different types
- 3-5 proposals in various statuses (pending, executed, declined)
- 2-3 prospect requests at different pipeline stages
- 10-15 audit events for a realistic activity feed
- Run via `pnpm db:seed` using tsx

**Why:** Right now the app is empty on first run. A seed script makes demos instant and helps new developers understand the data model.

---

## Phase B: RealFspClient Prep (High Priority)

### B.1 — Implement All 18 HTTP Methods in RealFspClient
The `src/lib/fsp-client/client.ts` currently throws `notImplemented()` for every method. We have:
- Exact endpoint URLs from `api-appendix.md`
- Request/response shapes from the appendix
- Base URLs from `env.example` (development-fsp.azure-api.net, api-develop.flightschedulepro.com)
- Auth pattern: Bearer token + x-subscription-key header

Write the actual `fetch()` calls with proper headers, URL construction, and response parsing. When credentials arrive, it should just work.

Methods to implement:
1. authenticate / refreshSession
2. getLocations / getAircraft / getInstructors / getActivityTypes / getSchedulingGroups / getUsers
3. getAvailability
4. getSchedule
5. getSchedulableEvents
6. findATime
7. autoSchedule
8. validateReservation / createReservation / getReservation / listReservations
9. getEnrollments / getEnrollmentProgress
10. getCivilTwilight

### B.2 — Rate Limiter
FSP enforces 60 requests per 60 seconds. Add a simple token-bucket rate limiter to the RealFspClient so we don't get 429s when the cron job fans out per-operator.

---

## Phase C: UI Polish (Medium Priority)

### C.1 — Error States
- API call failures show a generic error. Add retry buttons and contextual messages.
- Network timeout / server down should show a clear message, not a blank screen.

### C.2 — Empty States
- Dashboard with zero proposals: "No proposals yet — the system generates them automatically when schedule events are detected."
- Proposals list with no matches: "No proposals match these filters."
- Discovery list empty: "No discovery flight requests yet."
- Activity feed empty: "No activity recorded yet."

### C.3 — Loading Skeletons Audit
- Verify all pages show proper skeletons during data fetch
- Check that skeleton layout matches the actual content layout

---

## Phase D: Reliability (Medium Priority)

### D.1 — Snapshot Persistence
The cancellation detector stores schedule snapshots in an in-memory `Map`. On server restart, it loses the baseline and re-captures (one cycle of no detections). Move to:
- Option A: Store snapshots in a new DB table (simple, durable)
- Option B: Store in Redis (fast, ephemeral but survives app restarts)
Recommend Option A for MVP.

### D.2 — Optimistic Locking on Proposal Approval
Add `WHERE status = 'pending'` to the UPDATE query so concurrent approvals of the same proposal are rejected at the DB level instead of relying on application-level check-then-act.

---

## Phase E: Cleanup (Low Priority)

### E.1 — Clean Up Worktrees
Delete `.claude/worktrees/` contents — 8+ stale worktrees from agent dispatch.

### E.2 — Remove Dead Code
- The old `src/lib/api/mappers/audit-mapper.ts` from WU-0 may be duplicated by WU-1's version
- Check for any unused imports or stale files

### E.3 — Update CLAUDE.md
- The dev cycle instructions reference plans that no longer exist
- Add the real FSP base URLs as context for future sessions

---

## Execution Order

```
A.1 (test waitlist) ──┐
A.2 (test settings) ──┤── can run in parallel
A.3 (seed script)   ──┘
         │
         v
B.1 (RealFspClient) ──── largest single task, can start immediately
B.2 (rate limiter)   ──── small, depends on B.1
         │
         v
C.1-C.3 (UI polish) ──── can run in parallel
         │
         v
D.1-D.2 (reliability) ── depends on nothing, can start anytime
         │
         v
E.1-E.3 (cleanup) ──── last, lowest priority
```

## Estimated Scope
- Phase A: ~1 hour (testing + seed script)
- Phase B: ~2-3 hours (18 HTTP methods + rate limiter)
- Phase C: ~1 hour (UI polish)
- Phase D: ~1 hour (snapshot table + optimistic locking)
- Phase E: ~30 min (cleanup)
