import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const operatorSettings = pgTable(
  "operator_settings",
  {
    id: uuid().primaryKey().defaultRandom(),
    operatorId: integer().notNull().unique(),
    timeSinceLastFlightWeight: real().notNull().default(1.0),
    timeUntilNextFlightWeight: real().notNull().default(1.0),
    totalFlightHoursWeight: real().notNull().default(0.5),
    preferSameInstructor: boolean().notNull().default(true),
    preferSameInstructorWeight: real().notNull().default(0.8),
    preferSameAircraft: boolean().notNull().default(false),
    preferSameAircraftWeight: real().notNull().default(0.3),
    searchWindowDays: integer().notNull().default(7),
    topNAlternatives: integer().notNull().default(5),
    daylightOnly: boolean().notNull().default(true),
    enabledWorkflows: jsonb()
      .notNull()
      .default({
        reschedule: true,
        discovery_flight: true,
        next_lesson: true,
        waitlist: true,
      }),
    communicationPreferences: jsonb()
      .notNull()
      .default({ email: true, sms: false }),
    customWeights: jsonb()
      .notNull()
      .default([])
      .$type<
        Array<{
          name: string;
          signal: string;
          weight: number;
          enabled: boolean;
        }>
      >(),
    autoApprovalEnabled: boolean().notNull().default(false),
    autoApprovalThreshold: real().notNull().default(0.7),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index("operator_settings_operator_id_idx").on(table.operatorId)]
);

export const operatorSettingsRelations = relations(
  operatorSettings,
  () => ({})
);
