CREATE TYPE "public"."plan_status" AS ENUM('active', 'inactive');--> statement-breakpoint
CREATE TABLE "app_ai_config" (
	"id" text PRIMARY KEY DEFAULT 'app' NOT NULL,
	"admin_provider" "ai_provider" DEFAULT 'openai' NOT NULL,
	"admin_model" text,
	"admin_key_ciphertext" text,
	"admin_key_last4" text,
	"default_prompt_summary" text,
	"default_prompt_draft" text,
	"default_prompt_score" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_settings" (
	"id" text PRIMARY KEY DEFAULT 'app' NOT NULL,
	"app_name" text DEFAULT 'Job Management Portal' NOT NULL,
	"support_email" text,
	"timezone" text DEFAULT 'Asia/Kolkata' NOT NULL,
	"allow_signup" boolean DEFAULT false NOT NULL,
	"maintenance" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_config" (
	"id" text PRIMARY KEY DEFAULT 'app' NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"provider" text DEFAULT 'razorpay' NOT NULL,
	"mode" text DEFAULT 'test' NOT NULL,
	"currency" text DEFAULT 'INR' NOT NULL,
	"key_id" text,
	"key_secret_ciphertext" text,
	"gstin" text,
	"tax_rate" integer DEFAULT 18 NOT NULL,
	"prices_include_tax" boolean DEFAULT false NOT NULL,
	"company_name" text,
	"company_address" text,
	"invoice_prefix" text DEFAULT 'JMP-' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cron_config" (
	"id" text PRIMARY KEY DEFAULT 'app' NOT NULL,
	"sync_interval_hours" integer DEFAULT 6 NOT NULL,
	"quiet_enabled" boolean DEFAULT false NOT NULL,
	"quiet_from" text DEFAULT '22:00' NOT NULL,
	"quiet_to" text DEFAULT '07:00' NOT NULL,
	"quiet_tz" text DEFAULT 'Asia/Kolkata' NOT NULL,
	"quiet_days" text[] DEFAULT '{}'::text[] NOT NULL,
	"purge_enabled" boolean DEFAULT false NOT NULL,
	"purge_days" integer DEFAULT 90 NOT NULL,
	"purge_statuses" text[] DEFAULT '{}'::text[] NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"accent" text DEFAULT 'indigo' NOT NULL,
	"is_free" boolean DEFAULT false NOT NULL,
	"free_duration_days" integer DEFAULT 0 NOT NULL,
	"monthly_price" integer DEFAULT 0 NOT NULL,
	"yearly_price" integer DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'INR' NOT NULL,
	"limit_resumes" integer,
	"allow_custom_prompts" boolean DEFAULT false NOT NULL,
	"features" text[] DEFAULT '{}'::text[] NOT NULL,
	"popular" boolean DEFAULT false NOT NULL,
	"status" "plan_status" DEFAULT 'active' NOT NULL,
	"ever_subscribed" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plans_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "security_config" (
	"id" text PRIMARY KEY DEFAULT 'app' NOT NULL,
	"pw_min_length" integer DEFAULT 8 NOT NULL,
	"pw_require_upper" boolean DEFAULT true NOT NULL,
	"pw_require_lower" boolean DEFAULT true NOT NULL,
	"pw_require_number" boolean DEFAULT true NOT NULL,
	"pw_require_special" boolean DEFAULT true NOT NULL,
	"session_value" integer DEFAULT 7 NOT NULL,
	"session_unit" text DEFAULT 'days' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "smtp_config" ADD COLUMN "encryption" text DEFAULT 'starttls' NOT NULL;--> statement-breakpoint
ALTER TABLE "smtp_config" ADD COLUMN "reply_to" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "role" text DEFAULT 'user' NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "status" text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "plan_id" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "plan_expires_at" timestamp;