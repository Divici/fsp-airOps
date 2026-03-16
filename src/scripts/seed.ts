/**
 * Database seed script for development.
 * Populates demo data for operatorId 1.
 *
 * Usage: pnpm db:seed  (or: tsx src/scripts/seed.ts)
 */

import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import postgres from "postgres";

import {
  approvalDecisions,
  proposalActions,
  proposals,
  schedulingTriggers,
  prospectRequests,
  auditEvents,
  operatorSettings,
  communicationRecords,
} from "../lib/db/schema";

// ---------------------------------------------------------------------------
// Connection
// ---------------------------------------------------------------------------

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL environment variable is not set");
  process.exit(1);
}

const client = postgres(connectionString);
const db = drizzle(client);

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const OPERATOR_ID = 1;

// Fixed UUIDs for predictability
const TRIGGER_IDS = {
  t1: "10000000-0000-4000-a000-000000000e01",
  t2: "10000000-0000-4000-a000-000000000e02",
  t3: "10000000-0000-4000-a000-000000000e03",
  t4: "10000000-0000-4000-a000-000000000e04",
  t5: "10000000-0000-4000-a000-000000000e05",
} as const;

const PROPOSAL_IDS = {
  p1: "20000000-0000-4000-a000-0000000000b1",
  p2: "20000000-0000-4000-a000-0000000000b2",
  p3: "20000000-0000-4000-a000-0000000000b3",
  p4: "20000000-0000-4000-a000-0000000000b4",
  p5: "20000000-0000-4000-a000-0000000000b5",
} as const;

const PROSPECT_IDS = {
  pr1: "30000000-0000-4000-a000-0000000000c1",
  pr2: "30000000-0000-4000-a000-0000000000c2",
  pr3: "30000000-0000-4000-a000-0000000000c3",
} as const;

const APPROVAL_IDS = {
  a1: "40000000-0000-4000-a000-0000000000a1",
  a2: "40000000-0000-4000-a000-0000000000a2",
  a3: "40000000-0000-4000-a000-0000000000a3",
} as const;

// Mock entity IDs
const STUDENTS = {
  s1: "stu-aaa-1111",
  s2: "stu-bbb-2222",
  s3: "stu-ccc-3333",
};

const INSTRUCTORS = {
  i1: "inst-aaa-1111",
  i2: "inst-bbb-2222",
};

const AIRCRAFT = { a1: "ac-1", a2: "ac-2" };
const LOCATION_ID = 1;
const ACTIVITY_TYPE_ID = "at-1";

// Date helpers — seed dates relative to "now" so data always looks fresh
function daysFromNow(days: number, hour = 9): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, 0, 0, 0);
  return d;
}

function hoursAfter(base: Date, hours: number): Date {
  return new Date(base.getTime() + hours * 60 * 60 * 1000);
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function dayName(date: Date): string {
  return DAY_NAMES[date.getDay()];
}

function timeLabel(date: Date): string {
  const h = date.getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

// ---------------------------------------------------------------------------
// Seed function
// ---------------------------------------------------------------------------

async function seed() {
  console.log("Seeding database for operatorId", OPERATOR_ID);

  // 1. Clear existing data (FK-safe order)
  console.log("  Clearing existing data...");
  await db
    .delete(approvalDecisions)
    .where(eq(approvalDecisions.operatorId, OPERATOR_ID));
  await db
    .delete(communicationRecords)
    .where(eq(communicationRecords.operatorId, OPERATOR_ID));
  await db
    .delete(proposalActions)
    .where(eq(proposalActions.operatorId, OPERATOR_ID));
  await db
    .delete(prospectRequests)
    .where(eq(prospectRequests.operatorId, OPERATOR_ID));
  await db.delete(proposals).where(eq(proposals.operatorId, OPERATOR_ID));
  await db
    .delete(schedulingTriggers)
    .where(eq(schedulingTriggers.operatorId, OPERATOR_ID));
  await db
    .delete(auditEvents)
    .where(eq(auditEvents.operatorId, OPERATOR_ID));
  await db
    .delete(operatorSettings)
    .where(eq(operatorSettings.operatorId, OPERATOR_ID));
  console.log("  Cleared.");

  // 2. Operator settings
  console.log("  Inserting operator settings...");
  await db.insert(operatorSettings).values({
    operatorId: OPERATOR_ID,
    checkridePriorityWeight: 2.0,
    autoApprovalEnabled: true,
    autoApprovalThreshold: 0.7,
    enabledWorkflows: {
      reschedule: true,
      discovery_flight: true,
      next_lesson: true,
      waitlist: true,
    },
  });

  // 3. Scheduling triggers
  console.log("  Inserting scheduling triggers...");
  const now = new Date();
  await db.insert(schedulingTriggers).values([
    {
      id: TRIGGER_IDS.t1,
      operatorId: OPERATOR_ID,
      type: "cancellation",
      status: "completed",
      sourceEntityId: "res-100",
      sourceEntityType: "reservation",
      context: { reason: "Student requested reschedule due to weather" },
      processedAt: now,
    },
    {
      id: TRIGGER_IDS.t2,
      operatorId: OPERATOR_ID,
      type: "discovery_request",
      status: "completed",
      sourceEntityId: PROSPECT_IDS.pr2,
      sourceEntityType: "prospect_request",
      context: { source: "website_form" },
      processedAt: now,
    },
    {
      id: TRIGGER_IDS.t3,
      operatorId: OPERATOR_ID,
      type: "lesson_complete",
      status: "completed",
      sourceEntityId: "res-200",
      sourceEntityType: "reservation",
      context: { lessonType: "Stage 2 Lesson 4", studentId: STUDENTS.s3 },
      processedAt: now,
    },
    {
      id: TRIGGER_IDS.t4,
      operatorId: OPERATOR_ID,
      type: "cancellation",
      status: "completed",
      sourceEntityId: "res-300",
      sourceEntityType: "reservation",
      context: { reason: "Instructor unavailable" },
      processedAt: now,
    },
    {
      id: TRIGGER_IDS.t5,
      operatorId: OPERATOR_ID,
      type: "cancellation",
      status: "completed",
      sourceEntityId: "res-400",
      sourceEntityType: "reservation",
      context: { reason: "Aircraft maintenance", autoApprovalCandidate: true },
      processedAt: now,
    },
  ]);

  // 4. Proposals
  console.log("  Inserting proposals...");

  // Pre-compute dates so text descriptions match actual dates
  const p1RescheduleDate = daysFromNow(3, 9); // action 2 for proposal 1
  const p2DiscoveryDate = daysFromNow(4, 10);
  const p3LessonDate = daysFromNow(1, 14);
  const p4RescheduleDate = daysFromNow(3, 9);
  const p5SwapDate = daysFromNow(1, 9);

  await db.insert(proposals).values([
    {
      id: PROPOSAL_IDS.p1,
      operatorId: OPERATOR_ID,
      workflowType: "reschedule",
      triggerId: TRIGGER_IDS.t1,
      status: "pending",
      priority: 80,
      summary:
        `Reschedule Dave's Stage 3 checkride prep to ${dayName(p1RescheduleDate)} morning with the same instructor`,
      rationale:
        `Dave has not flown in 6 days and the checkride is next week. ${dayName(p1RescheduleDate)} 9 AM slot with Instructor Mike is open and keeps continuity.`,
      affectedStudentIds: [STUDENTS.s1],
      affectedReservationIds: ["res-100"],
      affectedResourceIds: [INSTRUCTORS.i1, AIRCRAFT.a1],
      expiresAt: daysFromNow(2),
    },
    {
      id: PROPOSAL_IDS.p2,
      operatorId: OPERATOR_ID,
      workflowType: "discovery_flight",
      triggerId: TRIGGER_IDS.t2,
      status: "pending",
      priority: 60,
      summary:
        `Schedule a discovery flight for prospect Jane Doe on ${dayName(p2DiscoveryDate)} at 10 AM`,
      rationale:
        `Jane submitted a discovery flight request. ${dayName(p2DiscoveryDate)} 10 AM has instructor and C172 availability. Booking within 48 hours of inquiry improves conversion rates.`,
      affectedStudentIds: [STUDENTS.s2],
      affectedResourceIds: [INSTRUCTORS.i2, AIRCRAFT.a2],
      expiresAt: daysFromNow(3),
    },
    {
      id: PROPOSAL_IDS.p3,
      operatorId: OPERATOR_ID,
      workflowType: "next_lesson",
      triggerId: TRIGGER_IDS.t3,
      status: "executed",
      priority: 40,
      summary:
        `Book Carlos's next lesson (Stage 2 Lesson 5) for ${dayName(p3LessonDate)} ${timeLabel(p3LessonDate)}`,
      rationale:
        `Carlos just completed Stage 2 Lesson 4. The syllabus calls for Lesson 5 within 5 days. ${dayName(p3LessonDate)} 2 PM with his regular instructor is available.`,
      affectedStudentIds: [STUDENTS.s3],
      affectedReservationIds: ["res-200"],
      affectedResourceIds: [INSTRUCTORS.i1, AIRCRAFT.a1],
    },
    {
      id: PROPOSAL_IDS.p4,
      operatorId: OPERATOR_ID,
      workflowType: "reschedule",
      triggerId: TRIGGER_IDS.t4,
      status: "declined",
      priority: 80,
      summary:
        "Reschedule Brian's cross-country flight with alternate instructor",
      rationale:
        `Brian's instructor called in sick. Instructor Sarah is available ${dayName(p4RescheduleDate)} at the same time. However, Brian has never flown with Sarah.`,
      affectedStudentIds: [STUDENTS.s2],
      affectedReservationIds: ["res-300"],
      affectedResourceIds: [INSTRUCTORS.i2, AIRCRAFT.a1],
    },
    {
      id: PROPOSAL_IDS.p5,
      operatorId: OPERATOR_ID,
      workflowType: "reschedule",
      triggerId: TRIGGER_IDS.t5,
      status: "executed",
      priority: 80,
      summary:
        "Auto-approved: reschedule Dave's pattern work to a different aircraft",
      rationale:
        "N12345 is down for maintenance. N67890 (same model) is available at the same time. Same instructor, same lesson — low risk swap.",
      affectedStudentIds: [STUDENTS.s1],
      affectedReservationIds: ["res-400"],
      affectedResourceIds: [INSTRUCTORS.i1, AIRCRAFT.a2],
      validationSnapshot: {
        autoApproved: true,
        decision: {
          decision: "approve",
          confidence: 0.92,
          reasoning: "Same-model aircraft swap with identical time and instructor. N67890 is the same make/model as N12345, same instructor and time slot — minimal disruption to the student's training.",
          riskFactors: ["Student has not flown N67890 before"],
          mitigations: ["Same aircraft model (C172S)", "Same instructor maintains continuity"],
          method: "rule-based",
        },
        toolCalls: [],
        threshold: 0.7,
        evaluatedAt: new Date().toISOString(),
      },
    },
  ]);

  // 5. Proposal actions
  console.log("  Inserting proposal actions...");
  const start1 = daysFromNow(2, 9); // original reservation to cancel
  // p1RescheduleDate, p2DiscoveryDate, p3LessonDate, p4RescheduleDate, p5SwapDate already defined above

  await db.insert(proposalActions).values([
    // Proposal 1 actions (2 actions)
    {
      proposalId: PROPOSAL_IDS.p1,
      operatorId: OPERATOR_ID,
      rank: 1,
      actionType: "cancel",
      startTime: start1,
      endTime: hoursAfter(start1, 2),
      locationId: LOCATION_ID,
      studentId: STUDENTS.s1,
      instructorId: INSTRUCTORS.i1,
      aircraftId: AIRCRAFT.a1,
      activityTypeId: ACTIVITY_TYPE_ID,
      explanation: "Cancel the original reservation that was weather-impacted",
      validationStatus: "valid",
      executionStatus: "pending",
    },
    {
      proposalId: PROPOSAL_IDS.p1,
      operatorId: OPERATOR_ID,
      rank: 2,
      actionType: "create_reservation",
      startTime: p1RescheduleDate,
      endTime: hoursAfter(p1RescheduleDate, 2),
      locationId: LOCATION_ID,
      studentId: STUDENTS.s1,
      instructorId: INSTRUCTORS.i1,
      aircraftId: AIRCRAFT.a1,
      activityTypeId: ACTIVITY_TYPE_ID,
      explanation:
        `Create new reservation on ${dayName(p1RescheduleDate)} morning with the same instructor and aircraft`,
      validationStatus: "valid",
      executionStatus: "pending",
    },
    // Proposal 2 actions (1 action)
    {
      proposalId: PROPOSAL_IDS.p2,
      operatorId: OPERATOR_ID,
      rank: 1,
      actionType: "create_reservation",
      startTime: p2DiscoveryDate,
      endTime: hoursAfter(p2DiscoveryDate, 1.5),
      locationId: LOCATION_ID,
      studentId: STUDENTS.s2,
      instructorId: INSTRUCTORS.i2,
      aircraftId: AIRCRAFT.a2,
      activityTypeId: ACTIVITY_TYPE_ID,
      explanation:
        `Book discovery flight for prospect Jane Doe, ${dayName(p2DiscoveryDate)} 10 AM`,
      validationStatus: "valid",
      executionStatus: "pending",
    },
    // Proposal 3 actions (1 action — executed)
    {
      proposalId: PROPOSAL_IDS.p3,
      operatorId: OPERATOR_ID,
      rank: 1,
      actionType: "create_reservation",
      startTime: p3LessonDate,
      endTime: hoursAfter(p3LessonDate, 2),
      locationId: LOCATION_ID,
      studentId: STUDENTS.s3,
      instructorId: INSTRUCTORS.i1,
      aircraftId: AIRCRAFT.a1,
      activityTypeId: ACTIVITY_TYPE_ID,
      explanation: `Book Stage 2 Lesson 5 for Carlos, ${dayName(p3LessonDate)} 2 PM`,
      validationStatus: "valid",
      executionStatus: "created",
      fspReservationId: "fsp-res-55001",
    },
    // Proposal 4 actions (2 actions — declined)
    {
      proposalId: PROPOSAL_IDS.p4,
      operatorId: OPERATOR_ID,
      rank: 1,
      actionType: "cancel",
      startTime: p4RescheduleDate,
      endTime: hoursAfter(p4RescheduleDate, 3),
      locationId: LOCATION_ID,
      studentId: STUDENTS.s2,
      instructorId: INSTRUCTORS.i1,
      aircraftId: AIRCRAFT.a1,
      activityTypeId: ACTIVITY_TYPE_ID,
      explanation: "Cancel original reservation with unavailable instructor",
      validationStatus: "valid",
      executionStatus: "pending",
    },
    {
      proposalId: PROPOSAL_IDS.p4,
      operatorId: OPERATOR_ID,
      rank: 2,
      actionType: "create_reservation",
      startTime: p4RescheduleDate,
      endTime: hoursAfter(p4RescheduleDate, 3),
      locationId: LOCATION_ID,
      studentId: STUDENTS.s2,
      instructorId: INSTRUCTORS.i2,
      aircraftId: AIRCRAFT.a1,
      activityTypeId: ACTIVITY_TYPE_ID,
      explanation:
        `Rebook with alternate instructor Sarah on ${dayName(p4RescheduleDate)} at the same time/aircraft`,
      validationStatus: "valid",
      executionStatus: "pending",
    },
    // Proposal 5 actions (2 actions — auto-approved & executed)
    {
      proposalId: PROPOSAL_IDS.p5,
      operatorId: OPERATOR_ID,
      rank: 1,
      actionType: "cancel",
      startTime: p5SwapDate,
      endTime: hoursAfter(p5SwapDate, 1.5),
      locationId: LOCATION_ID,
      studentId: STUDENTS.s1,
      instructorId: INSTRUCTORS.i1,
      aircraftId: AIRCRAFT.a1,
      activityTypeId: ACTIVITY_TYPE_ID,
      explanation:
        "Cancel reservation on grounded aircraft N12345",
      validationStatus: "valid",
      executionStatus: "created",
    },
    {
      proposalId: PROPOSAL_IDS.p5,
      operatorId: OPERATOR_ID,
      rank: 2,
      actionType: "create_reservation",
      startTime: p5SwapDate,
      endTime: hoursAfter(p5SwapDate, 1.5),
      locationId: LOCATION_ID,
      studentId: STUDENTS.s1,
      instructorId: INSTRUCTORS.i1,
      aircraftId: AIRCRAFT.a2,
      activityTypeId: ACTIVITY_TYPE_ID,
      explanation:
        "Rebook on replacement aircraft N67890 (same model, same time)",
      validationStatus: "valid",
      executionStatus: "created",
      fspReservationId: "fsp-res-55002",
    },
  ]);

  // 6. Prospect requests
  console.log("  Inserting prospect requests...");
  await db.insert(prospectRequests).values([
    {
      id: PROSPECT_IDS.pr1,
      operatorId: OPERATOR_ID,
      firstName: "Tom",
      lastName: "Rivera",
      email: "tom.rivera@example.com",
      phone: "555-0101",
      preferredLocationId: LOCATION_ID,
      preferredDateStart: daysFromNow(5).toISOString().slice(0, 10),
      preferredDateEnd: daysFromNow(12).toISOString().slice(0, 10),
      preferredTimeWindows: [
        { day: "Saturday", start: "09:00", end: "12:00" },
      ],
      notes: "Interested in becoming a private pilot",
      status: "new",
    },
    {
      id: PROSPECT_IDS.pr2,
      operatorId: OPERATOR_ID,
      firstName: "Jane",
      lastName: "Doe",
      email: "jane.doe@example.com",
      phone: "555-0202",
      preferredLocationId: LOCATION_ID,
      preferredDateStart: daysFromNow(4).toISOString().slice(0, 10),
      preferredDateEnd: daysFromNow(7).toISOString().slice(0, 10),
      preferredTimeWindows: [
        { day: "Saturday", start: "10:00", end: "11:30" },
      ],
      notes: "Found us on Google, wants to try flying",
      status: "proposed",
      linkedProposalId: PROPOSAL_IDS.p2,
    },
    {
      id: PROSPECT_IDS.pr3,
      operatorId: OPERATOR_ID,
      firstName: "Mike",
      lastName: "Chen",
      email: "mike.chen@example.com",
      phone: "555-0303",
      preferredLocationId: LOCATION_ID,
      preferredDateStart: daysFromNow(-3).toISOString().slice(0, 10),
      preferredDateEnd: daysFromNow(-1).toISOString().slice(0, 10),
      notes: "Referred by a current student",
      status: "booked",
      linkedReservationId: "fsp-res-44001",
    },
  ]);

  // 7. Approval decisions
  console.log("  Inserting approval decisions...");
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
  const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);

  await db.insert(approvalDecisions).values([
    {
      id: APPROVAL_IDS.a1,
      proposalId: PROPOSAL_IDS.p3,
      operatorId: OPERATOR_ID,
      decidedByUserId: "dev-user-000",
      decision: "approved",
      notes: "Looks good, student needs to stay on track",
      decidedAt: twoHoursAgo,
    },
    {
      id: APPROVAL_IDS.a2,
      proposalId: PROPOSAL_IDS.p4,
      operatorId: OPERATOR_ID,
      decidedByUserId: "dev-user-000",
      decision: "declined",
      notes:
        "Brian prefers to wait for his regular instructor rather than fly with someone new before the cross-country",
      decidedAt: oneHourAgo,
    },
    {
      id: APPROVAL_IDS.a3,
      proposalId: PROPOSAL_IDS.p5,
      operatorId: OPERATOR_ID,
      decidedByUserId: "system:auto-approver",
      decision: "approved",
      notes:
        "Auto-approved: same-model aircraft swap, confidence 0.92, risk low",
      decidedAt: thirtyMinAgo,
    },
  ]);

  // 8. Audit events
  console.log("  Inserting audit events...");
  const auditBase = new Date(Date.now() - 3 * 60 * 60 * 1000); // 3 hours ago
  function auditTime(offsetMinutes: number): Date {
    return new Date(auditBase.getTime() + offsetMinutes * 60 * 1000);
  }

  await db.insert(auditEvents).values([
    // Trigger received events
    {
      operatorId: OPERATOR_ID,
      eventType: "trigger_received",
      entityId: TRIGGER_IDS.t1,
      entityType: "scheduling_trigger",
      payload: { triggerType: "cancellation", sourceEntityId: "res-100" },
      createdAt: auditTime(0),
    },
    {
      operatorId: OPERATOR_ID,
      eventType: "trigger_received",
      entityId: TRIGGER_IDS.t2,
      entityType: "scheduling_trigger",
      payload: { triggerType: "discovery_request", source: "website_form" },
      createdAt: auditTime(5),
    },
    {
      operatorId: OPERATOR_ID,
      eventType: "trigger_received",
      entityId: TRIGGER_IDS.t3,
      entityType: "scheduling_trigger",
      payload: { triggerType: "lesson_complete", lessonType: "Stage 2 Lesson 4" },
      createdAt: auditTime(10),
    },
    {
      operatorId: OPERATOR_ID,
      eventType: "trigger_received",
      entityId: TRIGGER_IDS.t4,
      entityType: "scheduling_trigger",
      payload: { triggerType: "cancellation", sourceEntityId: "res-300" },
      createdAt: auditTime(15),
    },
    {
      operatorId: OPERATOR_ID,
      eventType: "trigger_received",
      entityId: TRIGGER_IDS.t5,
      entityType: "scheduling_trigger",
      payload: { triggerType: "cancellation", sourceEntityId: "res-400" },
      createdAt: auditTime(20),
    },
    // Proposal generated events
    {
      operatorId: OPERATOR_ID,
      eventType: "proposal_generated",
      entityId: PROPOSAL_IDS.p1,
      entityType: "proposal",
      payload: { workflowType: "reschedule", priority: 80 },
      createdAt: auditTime(30),
    },
    {
      operatorId: OPERATOR_ID,
      eventType: "proposal_generated",
      entityId: PROPOSAL_IDS.p2,
      entityType: "proposal",
      payload: { workflowType: "discovery_flight", priority: 60 },
      createdAt: auditTime(35),
    },
    {
      operatorId: OPERATOR_ID,
      eventType: "proposal_generated",
      entityId: PROPOSAL_IDS.p3,
      entityType: "proposal",
      payload: { workflowType: "next_lesson", priority: 40 },
      createdAt: auditTime(40),
    },
    {
      operatorId: OPERATOR_ID,
      eventType: "proposal_generated",
      entityId: PROPOSAL_IDS.p4,
      entityType: "proposal",
      payload: { workflowType: "reschedule", priority: 80 },
      createdAt: auditTime(45),
    },
    {
      operatorId: OPERATOR_ID,
      eventType: "proposal_generated",
      entityId: PROPOSAL_IDS.p5,
      entityType: "proposal",
      payload: { workflowType: "reschedule", priority: 80, autoApprovalCandidate: true },
      createdAt: auditTime(50),
    },
    // Risk assessed
    {
      operatorId: OPERATOR_ID,
      eventType: "risk_assessed",
      entityId: PROPOSAL_IDS.p5,
      entityType: "proposal",
      payload: { riskLevel: "low", confidenceScore: 0.92, model: "rule-based" },
      createdAt: auditTime(52),
    },
    // Approval / decline / auto-approval events
    {
      operatorId: OPERATOR_ID,
      eventType: "proposal_approved",
      entityId: PROPOSAL_IDS.p3,
      entityType: "proposal",
      payload: { decidedBy: "dev-user-000" },
      createdAt: auditTime(60),
    },
    {
      operatorId: OPERATOR_ID,
      eventType: "proposal_declined",
      entityId: PROPOSAL_IDS.p4,
      entityType: "proposal",
      payload: {
        decidedBy: "dev-user-000",
        reason: "Student prefers to wait for regular instructor",
      },
      createdAt: auditTime(65),
    },
    {
      operatorId: OPERATOR_ID,
      eventType: "proposal_auto_approved",
      entityId: PROPOSAL_IDS.p5,
      entityType: "proposal",
      payload: { decidedBy: "system:auto-approver", confidenceScore: 0.92 },
      createdAt: auditTime(70),
    },
    // Reservation created
    {
      operatorId: OPERATOR_ID,
      eventType: "reservation_created",
      entityId: PROPOSAL_IDS.p3,
      entityType: "proposal",
      payload: { fspReservationId: "fsp-res-55001", studentId: STUDENTS.s3 },
      createdAt: auditTime(75),
    },
  ]);

  console.log("Seed complete. Inserted:");
  console.log("  - 1 operator settings record");
  console.log("  - 5 scheduling triggers");
  console.log("  - 5 proposals");
  console.log("  - 10 proposal actions");
  console.log("  - 3 prospect requests");
  console.log("  - 3 approval decisions");
  console.log("  - 15 audit events");

  await client.end();
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
