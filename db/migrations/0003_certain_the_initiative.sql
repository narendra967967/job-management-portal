-- Add user_id to job_lead_details (direct owner scoping). Added nullable,
-- backfilled from the parent lead's owner, then made NOT NULL + FK so existing
-- rows survive the migration.
ALTER TABLE "job_lead_details" ADD COLUMN "user_id" text;--> statement-breakpoint
UPDATE "job_lead_details" d SET "user_id" = l."user_id" FROM "job_leads" l WHERE l."id" = d."lead_id";--> statement-breakpoint
ALTER TABLE "job_lead_details" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "job_lead_details" ADD CONSTRAINT "job_lead_details_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
