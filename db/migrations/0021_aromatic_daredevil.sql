ALTER TABLE "app_settings" ADD COLUMN "tagline" text;--> statement-breakpoint
ALTER TABLE "app_settings" ADD COLUMN "show_tagline" boolean DEFAULT false NOT NULL;