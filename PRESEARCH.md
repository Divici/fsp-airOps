# PRESEARCH.md

# Agentic Scheduler for Flight Schedule Pro (FSP) — Presearch

## 1. Executive Summary

This project is an independently deployable, multi-tenant scheduling optimization application for Flight Schedule Pro (FSP). Its purpose is to monitor schedule state, identify opportunities or disruptions, generate schedule recommendations, and route those recommendations through an in-app approval queue before publishing changes.

Phase 1 (MVP) is **strictly suggest-and-approve**. The system must support all four MVP workflows:

1. Waitlist Automation
2. Reschedule on Cancellation
3. Discovery Flight Booking
4. Schedule Next Lesson on Completion

The strongest implementation approach is a **hybrid architecture**:
- **Deterministic scheduling and validation** for anything that can make or break reservation correctness
- **AI for orchestration, proposal assembly, prioritization support, and explainability**
- **Human approval** before any schedule mutation

This is the safest and most credible interpretation of “AI solution” for an enterprise scheduling product. It gives the product real intelligence without making an LLM the source of truth for schedule validity.

---

## 2. Product Understanding

### 2.1 Core Problem

Flight school scheduling is operationally expensive and directly impacts:
- student progress
- aircraft/instructor utilization
- weekly flight hours
- staff workload

Schedulers and dispatch staff spend significant time manually:
- reacting to cancellations
- finding alternatives
- filling openings
- scheduling follow-up lessons
- handling discovery flight requests

This product exists to reduce that manual effort while increasing flight-hours utilization.

### 2.2 Primary MVP Outcome

The MVP should optimize for two outcomes:

1. **Increase weekly flight hours**
   - faster refill of openings
   - better matching of students, instructors, and aircraft
   - more proactive scheduling

2. **Reduce manual scheduler effort**
   - high-quality, approval-ready suggestions
   - fewer edits needed after suggestion generation
   - consolidated review queue instead of ad hoc rescheduling work

### 2.3 MVP Shape

The MVP is not “autonomous scheduling.”
It is an **AI-assisted scheduling console** that:
- observes schedule state
- generates explainable proposals
- routes proposals to an approval queue
- validates changes before publishing
- logs every decision and action

### 2.4 Explicit Non-Goals for MVP

The MVP should not attempt to own:
- payments
- payroll/timekeeping
- grading/training records
- auto-approval timers or unattended fallback behavior

Those are outside the Phase 1 scope.

---

## 3. Agreed Product Decisions

The following decisions are intentionally locked for presearch and implementation direction.

### 3.1 Application Shape
- Build as a **standalone web application**
- Architect it to be **embedded-ready** in the future
- UX should feel **visually close to FSP**
- Use a **left-nav enterprise dashboard layout**
- AI should remain **mostly invisible** in the UI

### 3.2 Technology Direction
- Use **TypeScript** as the primary implementation language
- Build a **full-stack TypeScript system** if possible
- Prefer a modern web architecture suited for Azure-hosted enterprise SaaS

### 3.3 MVP Scope
All four PRD-defined MVP workflows are in scope for demo and implementation:
- Waitlist Automation
- Reschedule on Cancellation
- Discovery Flight Booking
- Schedule Next Lesson on Completion

### 3.4 Multi-Tenancy
- Multi-tenant from day one
- Tenant key = `operatorId`
- Strict data isolation
- Per-tenant policy/configuration
- Shared deployment is acceptable
- Soft tenancy is not acceptable

### 3.5 Configuration
- Include a **lightweight settings UI**
- Support operator-configurable ranking weights and scheduling preferences
- Do not build a large admin suite in MVP

### 3.6 Discovery Flights
- Include a **small public/prospect intake form**
- Store app-owned prospect/discovery request data if FSP lacks required fields
- Public intake is only the front door; scheduling still flows through the operator approval queue

### 3.7 AI Direction
- Use **one unified orchestration engine**
- Do **not** use a pure deterministic-only product
- Do **not** use a pure LLM-controlled scheduling product
- Use a **hybrid AI + deterministic** system

---

## 4. Why TypeScript

TypeScript is the recommended implementation language not simply because it is familiar, but because it is the best fit for the shape of the product.

### 4.1 Product-Led Justification
This application is primarily:
- a web-based operator console
- an orchestration layer over structured APIs
- a policy/configuration system
- a queue and approval workflow product
- a multi-step integration system

It is **not** primarily:
- a low-level compute-heavy engine
- a heavy numerical optimization system built from scratch
- a backend-only service without a complex UI surface

### 4.2 Technical Justification
TypeScript is a strong fit because it enables:
- shared types across frontend, backend, workers, and test fixtures
- faster iteration on structured payloads from FSP
- lower drift between UI models and API contracts
- easier implementation of a polished enterprise web experience
- faster iteration on policy-driven orchestration logic

### 4.3 Strategic Justification
The MVP will change frequently in:
- ranking policy
- approval workflows
- explanation formatting
- settings UX
- proposal grouping
- operator-specific behavior

TypeScript supports faster change velocity across those layers than a split-stack approach.

### 4.4 Caveat
If the FSP authentication library or any internal SDK is significantly better in .NET, that should be revisited later. For presearch, TypeScript remains the recommended default.

---

## 5. MVP Requirements Breakdown

## 5.1 Workflow A — Waitlist Automation

### Trigger
A schedule opening emerges through:
- cancellation
- schedule shift
- periodic evaluation

### Required Behavior
The system must:
- identify eligible candidates
- rank them using configurable weights
- ensure they satisfy hard constraints
- generate one or more proposals
- allow scheduler approval before publishing

### Constraints
Candidates must satisfy:
- availability
- required activity type
- aircraft/instructor compatibility
- daylight limits
- operator-specific policy rules

### Complexity
This is likely the hardest MVP workflow because it includes:
- candidate search
- ranking
- constraint checks
- proposal grouping
- explainability requirements
- operator-specific weighting

## 5.2 Workflow B — Reschedule on Cancellation

### Trigger
A reservation is canceled by a student or operator.

### Required Behavior
The system must:
- identify the affected reservation/student
- generate top N compatible alternatives
- prefer same activity and location
- optionally prefer same instructor/aircraft
- respect operator-defined search window
- route options for approval
- notify student after confirmation

### Complexity
This is likely the best anchor workflow because it is:
- tightly scoped
- highly demoable
- operationally valuable
- well-supported by Find-a-Time and validate-then-create flows

## 5.3 Workflow C — Discovery Flight Booking

### Trigger
A prospect requests a discovery flight.

### Required Behavior
The system must:
- capture the prospect request
- generate options that respect daylight-only constraints
- use eligible instructor/aircraft pairings
- respect the operator search window
- allow scheduler approval
- send confirmation after approval

### Important Scope Rule
Payment is external. This product should not attempt to own payment logic.

### Product Implication
If FSP does not natively hold all required discovery-flight intake fields, the app needs its own prospect/discovery request model.

## 5.4 Workflow D — Schedule Next Lesson on Completion

### Trigger
Either:
- a training lesson is completed, or
- a scheduled process finds students with pending next lessons

### Required Behavior
The system must:
- determine the next required training event
- derive the required lesson/activity from enrollment/progress data
- generate scheduling options
- account for student availability
- account for instructor continuity preferences
- account for aircraft requirements
- route to approval before booking

### Complexity
This is harder than rescheduling because it relies on:
- training progression data
- lesson mapping
- schedulable events
- enrollment state
- next-lesson derivation logic

---

## 6. Post-MVP Requirements to Design For

Even though they are not MVP, the architecture should support:

### Phase 2
- weather-based disruption adjustments
- maintenance-based disruption adjustments
- instructor-unavailability handling
- inactive-student outreach
- autonomous low-risk mode

### Phase 3
- fleet utilization optimization
- checkride/exam prioritization

This means the MVP architecture should already support:
- trigger extensibility
- proposal risk scoring
- event-driven evaluations
- future automation modes
- richer optimization workflows

---

## 7. Recommended Product Positioning

This product should not be positioned as “a chatbot that schedules flights.”

It should be positioned as:

> **An AI-assisted scheduling optimization console for flight schools that continuously monitors schedule opportunities, uses deterministic scheduling intelligence and FSP-native scheduling tools to generate explainable proposals, and routes them through a human approval queue.**

This framing is stronger because it is:
- safer
- more enterprise credible
- more aligned to the PRD
- easier to defend technically
- easier to evaluate and demo

---

## 8. AI Strategy

## 8.1 Recommendation

Use a **hybrid AI + deterministic architecture**.

### Deterministic Layer Owns
- hard constraints
- schedule validity
- candidate eligibility
- availability checks
- daylight checks
- reservation validation
- reservation execution
- policy math
- ranking formulas
- final booking correctness

### AI Layer Owns
- trigger interpretation
- workflow selection
- proposal assembly
- suggestion grouping
- rationale generation
- tradeoff summarization
- approval-ready packaging
- future natural-language policy assistance

### Human Layer Owns
- Phase 1 approvals
- review of proposed changes
- overrides and declines
- policy management

## 8.2 Why Not Pure LLM Scheduling
A pure LLM scheduling system would be risky because:
- schedule correctness depends on structured constraints
- availability and daylight rules are hard constraints
- reservation creation needs deterministic validation
- operators need trust and explainability
- scheduling errors are operationally expensive

## 8.3 Why Not Deterministic-Only
A deterministic-only system would work, but it undersells the “AI solution” expectation and misses real opportunities for:
- smarter proposal packaging
- explanation generation
- better operator UX
- future autonomy
- adaptive recommendation quality

## 8.4 Recommended AI Pattern
Use a **bounded orchestration agent** or orchestration graph with tool calling.

The agent should:
- inspect trigger context
- call internal structured tools
- collect results
- produce a structured proposal object
- generate rationale text
- never directly create reservations without deterministic validation and human approval

---

## 9. Should This Use RAG?

### Recommendation
RAG should **not** be central to the MVP architecture.

### Why
Most important context is structured, not document-based:
- schedule state
- availability windows
- reservations
- schedulable events
- aircraft/instructor constraints
- operator settings
- progress/enrollment data
- civil twilight
- weather

### Where RAG Could Help Later
RAG may be useful later for:
- operator-authored policy documentation
- help center / support copilot features
- natural-language explanation references
- internal playbooks or business-rule interpretation

### Conclusion
Prefer:
- structured retrieval
- typed tool calls
- database-backed policy/config retrieval
- cacheable derived features

Do not center scheduling logic on retrieval over documents.

---

## 10. Unified Orchestration Engine

## 10.1 Core Decision
All four MVP workflows should be handled by **one unified orchestration engine** rather than four unrelated pipelines.

## 10.2 Why
A unified engine gives:
- shared trigger handling
- shared policy loading
- shared tenant context enforcement
- shared scheduling tool usage
- shared proposal model
- shared approval and execution pipeline
- shared audit/event model
- simpler future expansion to Phase 2/3

## 10.3 Conceptual Flow

```text
Trigger
  -> Tenant Resolution
  -> Workflow Resolution
  -> Policy Load
  -> Structured Data Fetch
  -> Deterministic Scheduling / Search
  -> AI Proposal Assembly + Rationale
  -> Approval Queue
  -> Re-Validation
  -> Reservation Execution
  -> Communication
  -> Audit Logging

  # 10.4 Trigger Types

The engine should support:
● scheduled polling/evaluation
● cancellation-triggered evaluation
● discovery flight intake submission
● lesson completion / pending lesson detection
● on-demand operator evaluation
● future weather/maintenance/instructor disruption triggers

# 11. FSP Capability Mapping

# 11.1 Use Find-a-Time For

Best for:
● cancellation reschedule
● discovery flight booking
● next lesson suggestions
● simple single-student slot generation
Why:
● it is a targeted slot finder
● lower integration complexity
● well-suited to top-N alternatives


# 11.2 Use AutoSchedule For

Best for:
● more complex waitlist workflows
● multi-event or batch scheduling
● future fleet optimization
● disruption recovery involving multiple resources
Why:
● it is a heavier constraint-satisfaction engine
● better for system-level optimization
● higher payload complexity

# 11.3 Use Validate-Then-Create Reservations

This should be the standard execution path for MVP:

1. Generate suggestion
2. Await approval
3. Re-check data freshness if needed
4. Call reservation validate endpoint
5. Only create if still valid
6. Record result in audit log

# 11.4 Use Schedulable Events / Enrollment Data For

```
● pending next lessons
```

```
● training queue awareness
● determining what should be scheduled next
● future milestone-based prioritization
```
# 11.5 Use Weather / Civil Twilight For

```
● daylight-only constraints
● future disruption workflows
● VFR/IFR-aware extensions later
● enforcing day/night scheduling correctness
```
# 12. Recommended Implementation Order

All four flows are in scope, but implementation should still follow an order of complexity.

## 12.1 First: Reschedule on Cancellation

Reason:
● easiest to explain
● easiest to validate
● strong operational value
● clean approval story
● likely fastest to a stable end-to-end path

## 12.2 Second: Discovery Flight Booking

Reason:


```
● also slot-generation focused
● benefits from a contained intake model
● easy to demo from request -> proposal -> approval -> confirmation
```
## 12.3 Third: Schedule Next Lesson on Completion

Reason:
● requires more training-progress logic
● depends on deriving the next schedulable event

## 12.4 Fourth: Waitlist Automation

Reason:
● broadest search space
● most policy complexity
● hardest explainability burden
● highest chance of needing ranking iteration

# 13. Architecture Recommendation

# 13.1 High-Level Shape

## Frontend

A web console with:
● left navigation
● queue-first dashboard


```
● proposal detail view
● settings area
● discovery flight request intake view
● activity feed / audit views
```
## Backend API

Owns:
● app auth/session handling integration
● tenant context resolution
● settings persistence
● proposal APIs
● approval APIs
● prospect intake APIs
● audit/event APIs

## Orchestration Worker Layer

Owns:
● polling
● workflow execution
● tool orchestration
● proposal generation
● re-evaluation tasks
● communication jobs


## Persistence Layer

Stores app-owned data only:
● suggestions
● approvals/declines
● audit events
● communication records
● prospect requests
● per-tenant settings
● feature flags
● model/tool run metadata

## FSP Integration Layer

Owns:
● typed client wrappers around FSP APIs
● authentication/session handling
● input normalization
● retry/error handling
● rate handling
● consistent logging

# 13.2 Architectural Principle

FSP remains the **source of truth for reservations and resources**.
This app owns **derived operational artifacts**.
That line should remain strict.


# 14. UX / Product Surface

# 14.1 UX Goal

The UX should feel like a natural extension of FSP:
● enterprise
● operational
● dense enough for dispatch/scheduler users
● not chat-centric
● visually familiar
● schedule/action focused

# 14.2 Primary Screens

## A. Dashboard / Queue

Purpose:
● central operator workspace
● view pending proposals
● filter by workflow, urgency, location, status
● bulk approve/decline

## B. Proposal Details

Purpose:
● show recommended slot(s)


```
● show rationale
● show resource/student details
● show validation status
● show alternatives
● approve/decline action panel
```
## C. Schedule Opportunity View

Purpose:
● show source trigger
● highlight opening/disruption/opportunity
● show affected entities

## D. Discovery Flight Intake View

Purpose:
● internal visibility into prospect requests
● request status pipeline
● handoff to scheduling proposal

## E. Settings

Purpose:
● lightweight operator-configurable weights
● continuity preferences
● search window defaults
● proposal count settings


```
● communication preferences
```
## F. Activity / Audit Feed

Purpose:
● explain what happened
● show proposal lifecycle
● support trust and traceability

# 14.3 AI Visibility

AI should mostly be invisible.
It should appear as:
● “generated suggestion”
● rationale
● recommendation reasoning
● maybe a subtle “why this suggestion?” affordance
It should not dominate the UI as a chatbot.

# 15. Multi-Tenancy Design

# 15.1 Required Standard

The MVP must implement **real tenant isolation** , not implied isolation.

# 15.2 Acceptable MVP Tenancy Model

A shared deployment with strict tenant scoping is acceptable if:


```
● every app record includes operatorId
● every read/write is tenant-filtered
● every background job runs in tenant context
● every proposal belongs to exactly one tenant
● every settings record is tenant-specific
● every communication record is tenant-specific
● every audit record is tenant-specific
```
# 15.3 What Is Not Acceptable

```
● frontend-only tenant scoping
● globally queried jobs with filtering after fetch
● mixed-tenant caches without hard partitioning
● shared app records with optional tenant ownership
```
# 15.4 Future-Proofing

Even if MVP uses one shared database, the design should not block:
● later tenant sharding
● tenant-specific data retention settings
● stricter isolation tiers if needed

# 16. Data Model Recommendations

# 16.1 App-Owned Core Entities


## OperatorSettings

Per-tenant configuration such as:
● ranking weights
● search windows
● continuity preferences
● proposal count defaults
● communication preferences
● enabled workflows
● future risk thresholds

## SchedulingTrigger

Represents a detected event such as:
● cancellation
● opening
● discovery request
● lesson completion
● future weather disruption
● future maintenance issue

## Proposal

Represents a generated scheduling recommendation package.
Suggested fields:
● id


```
● operatorId
● workflowType
● triggerId
● status
● priority
● createdAt
● expiresAt
● proposedActions
● rationale
● summary
● affectedStudentIds
● affectedReservationIds
● affectedResourceIds
● validationSnapshot
● version
```
## ProposalAction

One proposed schedulable action inside a proposal.
Suggested fields:
● id
● proposalId
● rank
● actionType


```
● startTime
● endTime
● locationId
● studentId
● instructorId
● aircraftId
● trainingContext
● validationStatus
● executionStatus
```
## ApprovalDecision

Represents operator approval/decline.
Suggested fields:
● id
● proposalId
● decidedByUserId
● decision
● notes
● decidedAt

## AuditEvent

Immutable event log of:
● trigger received


```
● proposal generated
● approval granted/declined
● validation passed/failed
● reservation created/failed
● email sent
● SMS sent/failed
```
## CommunicationRecord

Tracks outbound messaging and its result.

## ProspectRequest

Discovery flight intake model.
Suggested fields:
● id
● operatorId
● firstName
● lastName
● email
● phone
● preferredLocationId
● preferredDateStart
● preferredDateEnd
● preferredTimeWindows
● notes


```
● status
● linkedProposalId
● linkedReservationId
```
# 16.2 FSP-Backed Entities

Do not treat these as app-owned system-of-record entities:
● reservations
● aircraft
● instructors
● locations
● activity types
● scheduling groups
● student availability
● enrollment progress
Cache if useful, but do not let caches become authoritative.

# 17. Lightweight Settings UI

The MVP should include a settings screen with a narrow scope.

# 17.1 Recommended Settings

```
● time since last flight weight
● time until next scheduled flight weight
```

```
● total flight hours weight
● prefer same instructor toggle/weight
● prefer same aircraft toggle/weight
● search window size
● top-N alternatives count
● daylight-only default where relevant
● optional custom rule placeholders
```
# 17.2 UX Principles

```
● simple sliders or numeric inputs
● concise descriptions
● reset to defaults
● preview/example explanation later if time permits
```
# 17.3 Why This Matters

This is important because the PRD explicitly expects operator-configurable weights and
per-tenant policy control.

# 18. Discovery Flight Intake Model

# 18.1 Recommendation

Include a small public-facing intake form.

# 18.2 Why


Discovery flight requests need a trigger source.
If FSP does not fully model the prospect or request attributes needed for scheduling, the app
must hold them.

# 18.3 Minimal Public Form Fields

```
● first name
● last name
● email
● phone
● preferred location
● preferred date range
● preferred time preference
● optional notes
```
# 18.4 Intake Flow

1. Prospect submits request
2. Request becomes a tenant-scoped intake record
3. Orchestration engine generates options
4. Scheduler reviews/approves
5. Reservation is created after validation
6. Prospect receives confirmation

# 19. Communications Strategy


# 19.1 Recommendation

Use:
● FSP-native email where supported
● abstracted SMS provider integration as a reusable service

# 19.2 MVP Scope

```
● email should be real if possible
● SMS can be adapter-based
● messaging must be auditable
● templates should be operator-editable in design, even if MVP editing is lightweight
```
# 19.3 Important Rule

Communication should happen only after:
● approval
● successful re-validation
● successful reservation creation or finalized confirmation state

# 20. Security, Compliance, and Reliability

# 20.1 Core Requirements

The design should respect:
● least privilege


```
● encryption in transit and at rest
● tenant isolation
● audit retention
● US residency assumptions
● observability and traceability
```
# 20.2 Operational Safety Rules

```
● no autonomous schedule mutations in MVP
● no skipping validation
● no direct LLM-to-booking path
● no cross-tenant job execution
● no silently dropped proposal/execution errors
```
# 20.3 Reliability Rules

```
● idempotent proposal generation where possible
● deduplication of repeated trigger events
● re-validation before execution
● clear error surfacing for operators
● timeout/retry policies around FSP calls
● background job observability
```
# 21. Observability and Evaluation


# 21.1 Product Metrics

Track:
● suggestion acceptance rate
● proposal-to-approval time
● time-to-fill openings
● weekly flight hours influenced
● manual edits after suggestion generation
● per-workflow success rate
● decline reasons

# 21.2 Operational Metrics

Track:
● workflow execution latency
● FSP API failure rate
● validation failure rate
● create reservation failure rate
● communication success/failure rates
● per-tenant queue depth
● trigger-to-proposal latency

# 21.3 AI Quality Metrics

Track:


```
● rationale usefulness
● approval rate by workflow
● operator trust indicators
● proposal edit frequency
● ranking quality over time
```
# 21.4 Future Learning Loop

Store decline reasons and edit patterns so future ranking and proposal generation can improve
without making the MVP autonomous.

# 22. Major Risks and Unknowns

# 22.1 FSP Integration Complexity

Even with the appendix, real-world integration details may still affect:
● auth/session flow
● permissions behavior
● edge cases in reservation validation
● data freshness and race conditions

# 22.2 Waitlist Ranking Quality

Waitlist quality depends heavily on:
● available signal quality
● operator preferences


```
● ranking calibration
● explanation clarity
```
# 22.3 Training Progress Interpretation

“Schedule next lesson” may require careful mapping between:
● enrollments
● schedulable events
● lessons
● reservation payload shape

# 22.4 Discovery Intake to Reservation Mapping

How prospect requests become FSP reservations may need additional integration decisions.

# 22.5 Timezone / Local-Time Correctness

Reservation creation and availability handling can be error-prone because:
● some APIs use UTC
● reservation create uses local time
● daylight constraints matter
● location-specific timezone behavior matters

# 22.6 Future-Phase Trigger Complexity

Weather, maintenance, and instructor disruptions should be designed for now, even if not all are
implemented immediately.


# 23. Open Questions for FSP Team

1. **Real-time events:** Does FSP support webhooks or event streams for reservation changes (create/cancel/update)?
2. **API rate limits:** What are the rate limits per operator? Per global? This affects polling strategy.
3. **Auth library:** What does the FSP authentication library provide? SDK? Token management? Session refresh?
4. **AutoSchedule solver limitations:** Max events per call? Timeout behavior? Cost per invocation?
5. **Find-a-Time response shape:** The API appendix lists the endpoint but not the response schema — need to capture this.
6. **Batch reservation limits:** Max batch size? Async processing time expectations?
7. **Email customization:** Can we customize email templates sent via FSP's `sendEmailNotification`, or do we need a separate email service for branded/templated communications?
8. **Discovery flight fields:** What specific fields does FSP lack for discovery flights that we'd need to store?
9. **Data freshness:** How stale can schedule data be before it causes conflicts? (Informs polling interval)
10. **Existing waitlist:** Does FSP have any existing waitlist functionality we'd complement or replace?

# 24. Recommended Technical Stance

# 24.1 Strong Recommendation

Build the MVP as:
● a standalone TypeScript web app
● with an FSP-like enterprise UX
● one unified orchestration engine
● deterministic scheduling tools
● AI-assisted proposal assembly and explainability
● strict tenant isolation by operatorId
● app-owned prospect intake and operational artifacts
● FSP-owned reservations/resources as source of truth

# 24.2 What Not To Build First

Do not start with:
● a chatbot-first UX
● heavy RAG infrastructure
● full autonomy
● a custom scheduling engine replacing FSP tools
● a giant admin/settings system
● payment logic
● multi-DB tenancy unless required later


# 25. Final Recommendation

The ideal MVP is not “an AI that directly books flights.”
It is:
**A tenant-safe, FSP-aligned scheduling operations product that uses
deterministic scheduling constraints and FSP-native APIs to generate valid
opportunities, then uses AI to turn those results into explainable,
approval-ready proposals for schedulers.**
That direction is the best balance of:
● technical credibility
● enterprise safety
● demo clarity
● AI expectations
● future extensibility toward low-risk autonomy

# 26. Build Path Summary

## Phase 1 Foundation

```
● FSP auth/session integration
● tenant context model
● operator settings
● core DB schema
● FSP typed client wrappers
● audit/event framework
```
## Phase 2 Core Scheduling Engine


```
● unified orchestration engine
● trigger model
● reschedule-on-cancellation flow
● proposal generation model
● approval queue UI
```
## Phase 3 MVP Workflow Expansion

```
● discovery flight intake + scheduling
● next lesson scheduling
● waitlist automation
● lightweight settings UI
```
## Phase 4 Hardening

```
● observability
● feature flags
● audit polish
● messaging service abstraction
● UX refinement toward FSP familiarity
```
# 27. Open Decision Left Intentionally Unresolved

Demo strategy remains intentionally open:
● live FSP-backed demo


● mocked/replayed data
● hybrid approach
That can be decided later without changing the core architectural direction in this presearch.


