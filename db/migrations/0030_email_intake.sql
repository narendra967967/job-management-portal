CREATE TYPE "public"."inbound_parser" AS ENUM('linkedin', 'none');--> statement-breakpoint
CREATE TYPE "public"."inbound_status" AS ENUM('accepted', 'rejected', 'unsupported', 'duplicate', 'gmail_code');--> statement-breakpoint
CREATE TABLE "email_intake_config" (
	"id" text PRIMARY KEY DEFAULT 'app' NOT NULL,
	"forwarding_enabled" boolean DEFAULT true NOT NULL,
	"gmail_oauth_enabled" boolean DEFAULT true NOT NULL,
	"max_bytes" integer DEFAULT 2097152 NOT NULL,
	"gmail_toggled_at" timestamp with time zone,
	"gmail_toggled_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inbound_addresses" (
	"user_id" text PRIMARY KEY NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"gmail_code" text,
	"gmail_code_at" timestamp with time zone,
	"confirmed_at" timestamp with time zone,
	"first_received_at" timestamp with time zone,
	"last_received_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inbound_email_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" text,
	"from_address" text,
	"from_domain" text NOT NULL,
	"signing_domain" text,
	"status" "inbound_status" NOT NULL,
	"reason" text NOT NULL,
	"size_bytes" integer DEFAULT 0 NOT NULL,
	"message_id" text,
	"leads_created" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inbound_senders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match" text NOT NULL,
	"signing_domain" text NOT NULL,
	"parser" "inbound_parser" DEFAULT 'none' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "email_intake_config" ADD CONSTRAINT "email_intake_config_gmail_toggled_by_user_id_fk" FOREIGN KEY ("gmail_toggled_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inbound_addresses" ADD CONSTRAINT "inbound_addresses_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inbound_email_log" ADD CONSTRAINT "inbound_email_log_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "inbound_addresses_token_uq" ON "inbound_addresses" USING btree ("token");--> statement-breakpoint
CREATE INDEX "inbound_email_log_received_idx" ON "inbound_email_log" USING btree ("received_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "inbound_email_log_user_received_idx" ON "inbound_email_log" USING btree ("user_id","received_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "inbound_senders_match_uq" ON "inbound_senders" USING btree ("match");--> statement-breakpoint
-- Seed: the single config row (both intake switches on — today's behaviour) and
-- the LinkedIn job-alert senders, signed by linkedin.com and read by the
-- existing LinkedIn parser. Safe to re-run.
INSERT INTO "email_intake_config" ("id") VALUES ('app') ON CONFLICT ("id") DO NOTHING;--> statement-breakpoint
INSERT INTO "inbound_senders" ("match", "signing_domain", "parser", "enabled") VALUES
('jobalerts-noreply@linkedin.com', 'linkedin.com', 'linkedin', true),
('jobs-noreply@linkedin.com', 'linkedin.com', 'linkedin', true),
('jobs-listings@linkedin.com', 'linkedin.com', 'linkedin', true)
ON CONFLICT ("match") DO NOTHING;
