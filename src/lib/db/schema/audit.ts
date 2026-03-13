import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid().primaryKey().defaultRandom(),
    operatorId: integer().notNull(),
    eventType: text().notNull(),
    entityId: text(),
    entityType: text(),
    payload: jsonb(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("audit_events_operator_id_idx").on(table.operatorId)]
);
