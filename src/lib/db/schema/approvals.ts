import { relations } from "drizzle-orm";
import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { proposals } from "./proposals";

export const approvalDecisions = pgTable(
  "approval_decisions",
  {
    id: uuid().primaryKey().defaultRandom(),
    proposalId: uuid()
      .notNull()
      .references(() => proposals.id),
    operatorId: integer().notNull(),
    decidedByUserId: text().notNull(),
    decision: text().notNull().$type<"approved" | "declined">(),
    notes: text(),
    decidedAt: timestamp({ withTimezone: true }).notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("approval_decisions_operator_id_idx").on(table.operatorId),
  ]
);

export const approvalDecisionsRelations = relations(
  approvalDecisions,
  ({ one }) => ({
    proposal: one(proposals, {
      fields: [approvalDecisions.proposalId],
      references: [proposals.id],
    }),
  })
);
