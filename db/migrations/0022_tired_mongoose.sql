ALTER TABLE "plans" ADD COLUMN "is_default" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "plans_one_default_uq" ON "plans" USING btree ("is_default") WHERE "plans"."is_default";--> statement-breakpoint
-- Backfill: make the (single) active free plan the default sign-up plan so
-- registration keeps working. No-op if there's no active free plan.
UPDATE "plans" SET "is_default" = true
WHERE "id" = (
  SELECT "id" FROM "plans"
  WHERE "is_free" = true AND "status" = 'active'
  ORDER BY "created_at" LIMIT 1
);