CREATE TYPE "public"."email_provider" AS ENUM('smtp', 'ses');--> statement-breakpoint
CREATE TABLE "email_delivery" (
	"id" text PRIMARY KEY DEFAULT 'app' NOT NULL,
	"provider" "email_provider" DEFAULT 'smtp' NOT NULL,
	"ses_region" text DEFAULT '' NOT NULL,
	"ses_access_key_id" text DEFAULT '' NOT NULL,
	"ses_secret_ciphertext" text,
	"ses_from_name" text DEFAULT '' NOT NULL,
	"ses_from_email" text DEFAULT '' NOT NULL,
	"ses_reply_to" text DEFAULT '' NOT NULL,
	"ses_last_test_ok" boolean,
	"ses_last_test_at" timestamp with time zone,
	"ses_account" jsonb,
	"updated_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "email_delivery" ADD CONSTRAINT "email_delivery_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;