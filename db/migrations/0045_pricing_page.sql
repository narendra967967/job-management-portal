ALTER TABLE "plans" ADD COLUMN "show_on_pricing" boolean DEFAULT false NOT NULL;--> statement-breakpoint
-- List the real plans straight away: every active plan except obvious test plans.
-- Admins adjust per plan in Plans & Pricing ("Show on pricing page").
UPDATE "plans" SET "show_on_pricing" = true WHERE "status" = 'active' AND "name" NOT ILIKE '%test%';
