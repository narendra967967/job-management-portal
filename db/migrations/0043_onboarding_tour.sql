ALTER TABLE "user_settings" ADD COLUMN "tour_version" integer;--> statement-breakpoint
-- Existing accounts have used the app already: mark the first tour as seen so
-- only new sign-ups get it automatically (they can still start it from the sidebar).
UPDATE "user_settings" SET "tour_version" = 1 WHERE "tour_version" IS NULL;
