# Project Brief: FSP Agentic Scheduler

## Overview
An independently deployable, multi-tenant scheduling optimization application that integrates with Flight Schedule Pro (FSP) to automate and optimize flight school scheduling through an AI-assisted suggest-and-approve model.

## Goals
- Increase weekly flight hours through faster slot refill and better resource matching
- Reduce manual scheduler effort with high-quality, approval-ready suggestions
- Provide an enterprise-grade scheduling operations console for flight school operators

## Requirements (MVP)
Four core workflows, all suggest-and-approve:
1. **Waitlist Automation** -- rank eligible candidates for openings, propose bookings
2. **Reschedule on Cancellation** -- generate top N alternatives for cancelled reservations
3. **Discovery Flight Booking** -- prospect intake form + available slot generation
4. **Schedule Next Lesson** -- determine next training event, generate scheduling options

Cross-cutting requirements:
- Multi-tenant by operatorId with strict data isolation
- Explainable rationale for all suggestions
- Immutable audit log of all actions
- Operator-configurable ranking weights and preferences
- Email/SMS notifications after approval

## Deliverables
- Standalone web application with FSP-like enterprise UX
- Unified orchestration engine handling all four workflows
- Typed FSP API client layer
- Approval queue with bulk approve/decline
- Operator settings UI
- Discovery flight public intake form
- Audit/activity feed

## Scale Context
~1,300 operators, ~5,000 locations, ~30,000 instructors, ~80,000 students, ~20,000 daily flights
