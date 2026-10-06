CREATE TABLE "lead_purge_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"run_at" timestamp with time zone DEFAULT now() NOT NULL,
	"policy_days" integer NOT NULL,
	"statuses" text[] DEFAULT '{}'::text[] NOT NULL,
	"counts" jsonb NOT NULL,
	"total_deleted" integer NOT NULL,
	"notified" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lead_purge_log" ADD CONSTRAINT "lead_purge_log_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lead_purge_log_user_idx" ON "lead_purge_log" USING btree ("user_id","run_at" DESC NULLS LAST);--> statement-breakpoint
ALTER TABLE "cron_config" DROP COLUMN "sync_interval_hours";