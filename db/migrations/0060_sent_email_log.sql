CREATE TABLE "sent_email_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"to_address" text NOT NULL,
	"user_id" text,
	"kind" text NOT NULL,
	"template_key" text,
	"broadcast_id" uuid,
	"label" text NOT NULL,
	"subject" text DEFAULT '' NOT NULL,
	"channel" text NOT NULL,
	"status" text NOT NULL,
	"error" text,
	"message_id" text
);
--> statement-breakpoint
ALTER TABLE "retention_config" ADD COLUMN "sent_email_log_days" integer DEFAULT 30 NOT NULL;--> statement-breakpoint
ALTER TABLE "sent_email_log" ADD CONSTRAINT "sent_email_log_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sent_email_log" ADD CONSTRAINT "sent_email_log_broadcast_id_broadcasts_id_fk" FOREIGN KEY ("broadcast_id") REFERENCES "public"."broadcasts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sent_email_log_sent_idx" ON "sent_email_log" USING btree ("sent_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "sent_email_log_user_idx" ON "sent_email_log" USING btree ("user_id");