ALTER TYPE "public"."inbound_status" ADD VALUE 'queued';--> statement-breakpoint
CREATE TABLE "inbound_ai_queue" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"log_id" uuid,
	"message_id" text NOT NULL,
	"site" text NOT NULL,
	"subject" text DEFAULT '' NOT NULL,
	"body" text NOT NULL,
	"links" jsonb NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"locked_at" timestamp with time zone,
	"next_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "email_intake_config" ADD COLUMN "ai_max_jobs" integer DEFAULT 20 NOT NULL;--> statement-breakpoint
ALTER TABLE "inbound_ai_queue" ADD CONSTRAINT "inbound_ai_queue_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inbound_ai_queue" ADD CONSTRAINT "inbound_ai_queue_log_id_inbound_email_log_id_fk" FOREIGN KEY ("log_id") REFERENCES "public"."inbound_email_log"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "inbound_ai_queue_next_idx" ON "inbound_ai_queue" USING btree ("next_at");