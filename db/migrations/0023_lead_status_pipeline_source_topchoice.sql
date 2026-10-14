-- Hand-written (drizzle-kit wanted to DROP/re-CREATE lead_status, which fails on
-- existing 'reviewing' rows). Renaming the enum value in place relabels every
-- existing record at once; ADD VALUE is fine inside the migration transaction
-- (PG ≥ 12) because nothing below uses the new values.

-- 1. Pipeline statuses: Reviewing → Shortlisted; add Interview + Offer Received.
ALTER TYPE "public"."lead_status" RENAME VALUE 'reviewing' TO 'shortlisted';--> statement-breakpoint
ALTER TYPE "public"."lead_status" ADD VALUE IF NOT EXISTS 'interview' AFTER 'applied';--> statement-breakpoint
ALTER TYPE "public"."lead_status" ADD VALUE IF NOT EXISTS 'offer-received' AFTER 'interview';--> statement-breakpoint

-- Status names stored as plain text elsewhere follow the rename.
UPDATE "cron_config" SET "purge_statuses" = array_replace("purge_statuses", 'reviewing', 'shortlisted')
WHERE 'reviewing' = ANY("purge_statuses");--> statement-breakpoint
UPDATE "lead_purge_log" SET "statuses" = array_replace("statuses", 'reviewing', 'shortlisted')
WHERE 'reviewing' = ANY("statuses");--> statement-breakpoint
UPDATE "lead_purge_log"
SET "counts" = ("counts" - 'reviewing') || jsonb_build_object('shortlisted', "counts" -> 'reviewing')
WHERE "counts" ? 'reviewing';--> statement-breakpoint

-- 2. Source (job platform), origin (system vs manual), Top Choice.
CREATE TYPE "public"."lead_origin" AS ENUM('system', 'manual');--> statement-breakpoint
ALTER TABLE "job_leads" ADD COLUMN "source" text DEFAULT 'other' NOT NULL;--> statement-breakpoint
ALTER TABLE "job_leads" ADD COLUMN "origin" "lead_origin" DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "job_leads" ADD COLUMN "top_choice" boolean DEFAULT false NOT NULL;--> statement-breakpoint

-- Backfill: leads that came from a Gmail message were added by the system.
UPDATE "job_leads" SET "origin" = 'system' WHERE "source_message_id" IS NOT NULL;--> statement-breakpoint

-- Backfill source from the job URL's host (mirrors lib/lead-source.ts).
UPDATE "job_leads" AS l
SET "source" = CASE
  WHEN h.host ~ '(^|\.)(linkedin\.com|lnkd\.in)$' THEN 'linkedin'
  WHEN h.host ~ '(^|\.)naukri\.com$' THEN 'naukri'
  WHEN h.host ~ '(^|\.)indeed\.com$' THEN 'indeed'
  WHEN h.host ~ '(^|\.)glassdoor\.(com|co\.in)$' THEN 'glassdoor'
  WHEN h.host ~ '(^|\.)(wellfound\.com|angel\.co)$' THEN 'wellfound'
  WHEN h.host ~ '(^|\.)instahyre\.com$' THEN 'instahyre'
  WHEN h.host ~ '(^|\.)(foundit\.in|monsterindia\.com)$' THEN 'foundit'
  ELSE 'other'
END
FROM (
  SELECT "id", lower(substring("canonical_job_url" from '^[a-zA-Z][a-zA-Z0-9+.-]*://([^/:?#]+)')) AS host
  FROM "job_leads"
) AS h
WHERE h."id" = l."id";
