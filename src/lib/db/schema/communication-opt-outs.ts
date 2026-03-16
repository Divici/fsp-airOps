// ---------------------------------------------------------------------------
// Communication Opt-Outs — per-student opt-out from email/sms notifications
// ---------------------------------------------------------------------------

import {
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

export const communicationOptOuts = pgTable(
  "communication_opt_outs",
  {
    id: uuid().primaryKey().defaultRandom(),
    operatorId: integer().notNull(),
    studentId: text().notNull(),
    channel: text().notNull().$type<"email" | "sms">(),
    optedOutAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("communication_opt_outs_unique").on(
      table.operatorId,
      table.studentId,
      table.channel
    ),
  ]
);
