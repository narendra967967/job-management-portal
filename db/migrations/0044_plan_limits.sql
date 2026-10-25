CREATE TABLE "feature_usage" (
	"user_id" text NOT NULL,
	"feature" text NOT NULL,
	"month" text NOT NULL,
	"count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "plans" ADD COLUMN "limit_active_leads" integer;--> statement-breakpoint
ALTER TABLE "plans" ADD COLUMN "limit_ai_add_monthly" integer;--> statement-breakpoint
ALTER TABLE "plans" ADD COLUMN "allow_ai_drafts" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "plans" ADD COLUMN "allow_ai_email_reading" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "plans" ADD COLUMN "priority_support" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "feature_usage" ADD CONSTRAINT "feature_usage_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "feature_usage_user_feature_month_uq" ON "feature_usage" USING btree ("user_id","feature","month");--> statement-breakpoint
-- Paid plans already had AI drafts and AI email reading: keep them (no surprise
-- downgrade). Free plans start without; admins adjust per plan in Plans & Pricing.
UPDATE "plans" SET "allow_ai_drafts" = true, "allow_ai_email_reading" = true WHERE "is_free" = false;
