CREATE TABLE "lead_auto_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"lead_id" uuid NOT NULL,
	"rule" text NOT NULL,
	"from_status" "lead_status" NOT NULL,
	"from_close_outcome" "close_outcome",
	"to_status" "lead_status" NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"undone_at" timestamp with time zone,
	"cleared_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "lead_rules" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "lead_auto_actions" ADD CONSTRAINT "lead_auto_actions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_auto_actions" ADD CONSTRAINT "lead_auto_actions_lead_id_job_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."job_leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lead_auto_actions_user_idx" ON "lead_auto_actions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "lead_auto_actions_lead_idx" ON "lead_auto_actions" USING btree ("lead_id");