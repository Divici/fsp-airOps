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

import { proposals } from "./proposals";

export const schedulingTriggers = pgTable(
  "scheduling_triggers",
  {
    id: uuid().primaryKey().defaultRandom(),
    operatorId: integer().notNull(),
    type: text()
      .notNull()
      .$type<
        | "cancellation"
        | "discovery_request"
        | "lesson_complete"
        | "opening_detected"
        | "manual"
      >(),
    status: text()
      .notNull()
      .$type<"pending" | "processing" | "completed" | "failed" | "skipped">()
      .default("pending"),
    sourceEntityId: text(),
    sourceEntityType: text(),
    context: jsonb(),
    processedAt: timestamp({ withTimezone: true }),
    error: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("scheduling_triggers_operator_id_idx").on(table.operatorId),
  ]
);

export const schedulingTriggersRelations = relations(
  schedulingTriggers,
  ({ many }) => ({
    proposals: many(proposals),
  })
);
