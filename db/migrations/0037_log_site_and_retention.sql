CREATE TABLE "retention_config" (
	"id" text PRIMARY KEY DEFAULT 'app' NOT NULL,
	"inbound_log_days" integer DEFAULT 30 NOT NULL,
	"ingest_issue_days" integer DEFAULT 30 NOT NULL,
	"processed_ledger_days" integer DEFAULT 180 NOT NULL,
	"lead_purge_log_days" integer DEFAULT 365 NOT NULL,
	"notification_days" integer DEFAULT 90 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "inbound_email_log" ADD COLUMN "site" text;--> statement-breakpoint
-- Backfill: the site is the sender's domain, except older hand-forwards (original unknown).
UPDATE "inbound_email_log" SET "site" = "from_domain" WHERE "site" IS NULL AND "reason" NOT LIKE 'Hand-forwarded%';
--> statement-breakpoint
INSERT INTO "retention_config" ("id") VALUES ('app') ON CONFLICT ("id") DO NOTHING;
