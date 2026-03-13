# 0002: MVP Technology Choices

**Date:** 2026-03-13
**Status:** accepted

## Context
With the implementation plan finalized (48 tasks, 6 phases), five technology decisions needed to be locked before Phase 1 could begin. These choices affect nearly every task in the plan.

## Decisions

### UI Component Library: Shadcn/ui
- Tailwind-native, copies component source into project for full customization
- Uses Radix primitives underneath for accessible behavior
- User specifically wanted ability to freely modify component styling

**Rejected:** Radix primitives alone (too much styling work), Ant Design (fights Tailwind, opinionated CSS-in-JS)

### Background Jobs: Inngest
- Event-driven step functions with fan-out, retries, rate limiting
- Required because the PRD targets ~1,300 operators — simple cron can't fan out per-tenant
- Runs alongside Next.js, no Redis infrastructure needed
- Replaces the deferred decision from 0001

**Rejected:** API routes + cron (doesn't scale to 1,300 operators), BullMQ + Redis (requires Redis infra management)

### Timezone Handling: date-fns-tz
- Lightweight, tree-shakeable, pairs with date-fns
- Critical for FSP's UTC-vs-local-time mismatch (reservation create uses local time, AutoSchedule returns UTC)

**Rejected:** Luxon (larger bundle), dayjs (less mature timezone support)

### Auth Model: FSP Credential Proxy
- Users log in with FSP email/password
- App calls FSP auth API (`POST /common/v1.0/sessions/credentials`) to get token
- Simplest approach; no separate auth system to maintain
- Depends on FSP session refresh API for token renewal

**Rejected:** NextAuth (more setup than needed for MVP), API key per operator (no user-level identity)

### Client State: Server Components + TanStack Query
- Default pattern for Next.js App Router
- Server Components for initial data, TanStack Query for client-side mutations and cache

## Consequences
- Inngest adds a dev dependency and requires `npx inngest-cli dev` during development
- Shadcn/ui components are owned code — we maintain them, not a library
- FSP credential proxy means auth is coupled to FSP availability
- date-fns-tz is the single timezone utility — all time conversions go through it
