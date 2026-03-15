import {
  index,
  integer,
  jsonb,
  pgTable,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const scheduleSnapshots = pgTable(
  "schedule_snapshots",
  {
    id: uuid().primaryKey().defaultRandom(),
    operatorId: integer().notNull().unique(), // one snapshot per operator
    capturedAt: timestamp({ withTimezone: true }).notNull(),
    reservations: jsonb().notNull(), // serialized array of [string, FspReservationListItem] tuples
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("schedule_snapshots_operator_id_idx").on(table.operatorId)]
);
