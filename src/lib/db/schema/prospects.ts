import { relations } from "drizzle-orm";
import {
  date,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { proposals } from "./proposals";

export const prospectRequests = pgTable(
  "prospect_requests",
  {
    id: uuid().primaryKey().defaultRandom(),
    operatorId: integer().notNull(),
    firstName: text().notNull(),
    lastName: text().notNull(),
    email: text().notNull(),
    phone: text(),
    preferredLocationId: integer(),
    preferredDateStart: date(),
    preferredDateEnd: date(),
    preferredTimeWindows: jsonb(),
    notes: text(),
    status: text()
      .notNull()
      .$type<
        "new" | "processing" | "proposed" | "approved" | "booked" | "cancelled"
      >()
      .default("new"),
    linkedProposalId: uuid().references(() => proposals.id),
    linkedReservationId: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index("prospect_requests_operator_id_idx").on(table.operatorId)]
);

export const prospectRequestsRelations = relations(
  prospectRequests,
  ({ one }) => ({
    linkedProposal: one(proposals, {
      fields: [prospectRequests.linkedProposalId],
      references: [proposals.id],
    }),
  })
);
