CREATE TABLE "schedule_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"operatorId" integer NOT NULL,
	"capturedAt" timestamp with time zone NOT NULL,
	"reservations" jsonb NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "schedule_snapshots_operatorId_unique" UNIQUE("operatorId")
);
--> statement-breakpoint
CREATE INDEX "schedule_snapshots_operator_id_idx" ON "schedule_snapshots" USING btree ("operatorId");