ALTER TABLE "operator_settings" ALTER COLUMN "enabledWorkflows" SET DEFAULT '{"reschedule":true,"discovery_flight":true,"next_lesson":true,"waitlist":true,"inactivity_outreach":true,"weather_disruption":false}'::jsonb;--> statement-breakpoint
ALTER TABLE "operator_settings" ADD COLUMN "inactivityThresholdDays" integer DEFAULT 7 NOT NULL;--> statement-breakpoint
ALTER TABLE "operator_settings" ADD COLUMN "weatherMinCeiling" integer DEFAULT 1000 NOT NULL;--> statement-breakpoint
ALTER TABLE "operator_settings" ADD COLUMN "weatherMinVisibility" real DEFAULT 3 NOT NULL;