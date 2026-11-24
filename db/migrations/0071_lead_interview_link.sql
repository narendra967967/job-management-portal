ALTER TYPE "public"."task_kind" ADD VALUE 'practice';--> statement-breakpoint
ALTER TABLE "ai_interviews" ADD COLUMN "company" text;--> statement-breakpoint
ALTER TABLE "job_leads" ADD COLUMN "interview_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "job_leads" ADD COLUMN "interview_reminded_at" timestamp with time zone;--> statement-breakpoint
-- Existing bookings for a lead still there take its company.
UPDATE "ai_interviews" i SET "company" = l."company" FROM "job_leads" l WHERE i."lead_id" = l."id" AND i."company" IS NULL;
