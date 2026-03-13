CREATE TABLE "approval_decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proposalId" uuid NOT NULL,
	"operatorId" integer NOT NULL,
	"decidedByUserId" text NOT NULL,
	"decision" text NOT NULL,
	"notes" text,
	"decidedAt" timestamp with time zone NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"operatorId" integer NOT NULL,
	"eventType" text NOT NULL,
	"entityId" text,
	"entityType" text,
	"payload" jsonb,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "communication_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"operatorId" integer NOT NULL,
	"proposalId" uuid,
	"channel" text NOT NULL,
	"recipientId" text NOT NULL,
	"recipientAddress" text NOT NULL,
	"templateId" text,
	"subject" text,
	"body" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"sentAt" timestamp with time zone,
	"error" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "operator_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"operatorId" integer NOT NULL,
	"timeSinceLastFlightWeight" real DEFAULT 1 NOT NULL,
	"timeUntilNextFlightWeight" real DEFAULT 1 NOT NULL,
	"totalFlightHoursWeight" real DEFAULT 0.5 NOT NULL,
	"preferSameInstructor" boolean DEFAULT true NOT NULL,
	"preferSameInstructorWeight" real DEFAULT 0.8 NOT NULL,
	"preferSameAircraft" boolean DEFAULT false NOT NULL,
	"preferSameAircraftWeight" real DEFAULT 0.3 NOT NULL,
	"searchWindowDays" integer DEFAULT 7 NOT NULL,
	"topNAlternatives" integer DEFAULT 5 NOT NULL,
	"daylightOnly" boolean DEFAULT true NOT NULL,
	"enabledWorkflows" jsonb DEFAULT '{"reschedule":true,"discovery_flight":true,"next_lesson":true,"waitlist":true}'::jsonb NOT NULL,
	"communicationPreferences" jsonb DEFAULT '{"email":true,"sms":false}'::jsonb NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "operator_settings_operatorId_unique" UNIQUE("operatorId")
);
--> statement-breakpoint
CREATE TABLE "proposal_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proposalId" uuid NOT NULL,
	"operatorId" integer NOT NULL,
	"rank" integer NOT NULL,
	"actionType" text NOT NULL,
	"startTime" timestamp with time zone NOT NULL,
	"endTime" timestamp with time zone NOT NULL,
	"locationId" integer NOT NULL,
	"studentId" text NOT NULL,
	"instructorId" text,
	"aircraftId" text,
	"activityTypeId" text,
	"trainingContext" jsonb,
	"explanation" text,
	"validationStatus" text DEFAULT 'pending' NOT NULL,
	"executionStatus" text DEFAULT 'pending' NOT NULL,
	"executionError" text,
	"fspReservationId" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "proposals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"operatorId" integer NOT NULL,
	"workflowType" text NOT NULL,
	"triggerId" uuid,
	"status" text DEFAULT 'draft' NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"summary" text NOT NULL,
	"rationale" text NOT NULL,
	"affectedStudentIds" jsonb,
	"affectedReservationIds" jsonb,
	"affectedResourceIds" jsonb,
	"validationSnapshot" jsonb,
	"expiresAt" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prospect_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"operatorId" integer NOT NULL,
	"firstName" text NOT NULL,
	"lastName" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"preferredLocationId" integer,
	"preferredDateStart" date,
	"preferredDateEnd" date,
	"preferredTimeWindows" jsonb,
	"notes" text,
	"status" text DEFAULT 'new' NOT NULL,
	"linkedProposalId" uuid,
	"linkedReservationId" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scheduling_triggers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"operatorId" integer NOT NULL,
	"type" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"sourceEntityId" text,
	"sourceEntityType" text,
	"context" jsonb,
	"processedAt" timestamp with time zone,
	"error" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "approval_decisions" ADD CONSTRAINT "approval_decisions_proposalId_proposals_id_fk" FOREIGN KEY ("proposalId") REFERENCES "public"."proposals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communication_records" ADD CONSTRAINT "communication_records_proposalId_proposals_id_fk" FOREIGN KEY ("proposalId") REFERENCES "public"."proposals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_actions" ADD CONSTRAINT "proposal_actions_proposalId_proposals_id_fk" FOREIGN KEY ("proposalId") REFERENCES "public"."proposals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_triggerId_scheduling_triggers_id_fk" FOREIGN KEY ("triggerId") REFERENCES "public"."scheduling_triggers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prospect_requests" ADD CONSTRAINT "prospect_requests_linkedProposalId_proposals_id_fk" FOREIGN KEY ("linkedProposalId") REFERENCES "public"."proposals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "approval_decisions_operator_id_idx" ON "approval_decisions" USING btree ("operatorId");--> statement-breakpoint
CREATE INDEX "audit_events_operator_id_idx" ON "audit_events" USING btree ("operatorId");--> statement-breakpoint
CREATE INDEX "communication_records_operator_id_idx" ON "communication_records" USING btree ("operatorId");--> statement-breakpoint
CREATE INDEX "operator_settings_operator_id_idx" ON "operator_settings" USING btree ("operatorId");--> statement-breakpoint
CREATE INDEX "proposal_actions_operator_id_idx" ON "proposal_actions" USING btree ("operatorId");--> statement-breakpoint
CREATE INDEX "proposals_operator_id_idx" ON "proposals" USING btree ("operatorId");--> statement-breakpoint
CREATE INDEX "prospect_requests_operator_id_idx" ON "prospect_requests" USING btree ("operatorId");--> statement-breakpoint
CREATE INDEX "scheduling_triggers_operator_id_idx" ON "scheduling_triggers" USING btree ("operatorId");