# Product Context: FSP Agentic Scheduler

## Problem
Flight school scheduling is operationally expensive. Schedulers spend significant time manually reacting to cancellations, finding alternatives, filling openings, scheduling follow-up lessons, and handling discovery flight requests. This directly impacts student progress, aircraft/instructor utilization, and weekly flight hours.

## Solution
An AI-assisted scheduling optimization console that:
- Continuously monitors schedule state for opportunities and disruptions
- Uses deterministic scheduling constraints + FSP-native APIs for valid slot generation
- Uses AI to assemble explainable, approval-ready proposals
- Routes all proposals through a human approval queue before any schedule mutation

This is NOT a chatbot. It is NOT autonomous scheduling. It is an operational tool that makes schedulers faster and more effective.

## Target Users
| Role | Interaction |
|------|------------|
| Schedulers / Dispatch | Primary users -- review and approve suggestions in approval queue |
| Instructors | Receive confirmations and schedule changes |
| Students | Receive offers and confirmations |
| Prospects | Submit discovery flight requests, receive confirmations |
| Managers / Owners | Monitor performance, configure policies |

## User Experience Goals
- Enterprise, operational, dense -- designed for dispatch/scheduler power users
- Left-nav dashboard layout, queue-first design
- AI is mostly invisible -- appears as "generated suggestion" with rationale
- Visually close to FSP for familiarity
- Not chat-centric
