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

export const communicationRecords = pgTable(
  "communication_records",
  {
    id: uuid().primaryKey().defaultRandom(),
    operatorId: integer().notNull(),
    proposalId: uuid().references(() => proposals.id),
    channel: text().notNull().$type<"email" | "sms">(),
    recipientId: text().notNull(),
    recipientAddress: text().notNull(),
    templateId: text(),
    subject: text(),
    body: text().notNull(),
    status: text()
      .notNull()
      .$type<"pending" | "sent" | "failed" | "bounced">()
      .default("pending"),
    sentAt: timestamp({ withTimezone: true }),
    error: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("communication_records_operator_id_idx").on(table.operatorId),
  ]
);

export const communicationRecordsRelations = relations(
  communicationRecords,
  ({ one }) => ({
    proposal: one(proposals, {
      fields: [communicationRecords.proposalId],
      references: [proposals.id],
    }),
  })
);
