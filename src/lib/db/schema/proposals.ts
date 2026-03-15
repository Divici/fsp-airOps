import { relations } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { approvalDecisions } from "./approvals";
import { communicationRecords } from "./communications";
import { schedulingTriggers } from "./triggers";

export const proposals = pgTable(
  "proposals",
  {
    id: uuid().primaryKey().defaultRandom(),
    operatorId: integer().notNull(),
    workflowType: text()
      .notNull()
      .$type<"reschedule" | "discovery_flight" | "next_lesson" | "waitlist" | "inactivity_outreach" | "weather_disruption">(),
    triggerId: uuid().references(() => schedulingTriggers.id),
    status: text()
      .notNull()
      .$type<
        | "draft"
        | "pending"
        | "approved"
        | "declined"
        | "expired"
        | "executed"
        | "failed"
      >()
      .default("draft"),
    priority: integer().notNull().default(0),
    summary: text().notNull(),
    rationale: text().notNull(),
    affectedStudentIds: jsonb().$type<string[]>(),
    affectedReservationIds: jsonb().$type<string[]>(),
    affectedResourceIds: jsonb().$type<string[]>(),
    validationSnapshot: jsonb(),
    expiresAt: timestamp({ withTimezone: true }),
    version: integer().notNull().default(1),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index("proposals_operator_id_idx").on(table.operatorId)]
);

export const proposalsRelations = relations(proposals, ({ one, many }) => ({
  trigger: one(schedulingTriggers, {
    fields: [proposals.triggerId],
    references: [schedulingTriggers.id],
  }),
  actions: many(proposalActions),
  approvals: many(approvalDecisions),
  communications: many(communicationRecords),
}));

export const proposalActions = pgTable(
  "proposal_actions",
  {
    id: uuid().primaryKey().defaultRandom(),
    proposalId: uuid()
      .notNull()
      .references(() => proposals.id),
    operatorId: integer().notNull(),
    rank: integer().notNull(),
    actionType: text()
      .notNull()
      .$type<"create_reservation" | "reschedule" | "cancel">(),
    startTime: timestamp({ withTimezone: true }).notNull(),
    endTime: timestamp({ withTimezone: true }).notNull(),
    locationId: integer().notNull(),
    studentId: text().notNull(),
    instructorId: text(),
    aircraftId: text(),
    activityTypeId: text(),
    trainingContext: jsonb(),
    explanation: text(),
    validationStatus: text()
      .notNull()
      .$type<"pending" | "valid" | "invalid" | "stale">()
      .default("pending"),
    executionStatus: text()
      .notNull()
      .$type<"pending" | "validated" | "created" | "failed">()
      .default("pending"),
    executionError: text(),
    fspReservationId: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index("proposal_actions_operator_id_idx").on(table.operatorId)]
);

export const proposalActionsRelations = relations(
  proposalActions,
  ({ one }) => ({
    proposal: one(proposals, {
      fields: [proposalActions.proposalId],
      references: [proposals.id],
    }),
  })
);
