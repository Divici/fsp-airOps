CREATE TABLE "communication_opt_outs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"operatorId" integer NOT NULL,
	"studentId" text NOT NULL,
	"channel" text NOT NULL,
	"optedOutAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "communication_opt_outs_unique" UNIQUE("operatorId","studentId","channel")
);
