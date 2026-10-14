CREATE TABLE "user_notes" (
	"user_id" text PRIMARY KEY NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "gmail_config" ADD COLUMN "sync_paused_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "job_lead_details" ADD COLUMN "salary_insight" jsonb;--> statement-breakpoint
ALTER TABLE "job_lead_details" ADD COLUMN "salary_insight_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "plans" ADD COLUMN "allow_notes" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "plans" ADD COLUMN "allow_salary_insight" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "auto_status" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "max_follow_ups" integer DEFAULT 2 NOT NULL;--> statement-breakpoint
ALTER TABLE "user_notes" ADD CONSTRAINT "user_notes_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;