CREATE TYPE "public"."ai_provider" AS ENUM('openai', 'anthropic');--> statement-breakpoint
CREATE TYPE "public"."close_outcome" AS ENUM('offer', 'rejected', 'withdrawn', 'no-response');--> statement-breakpoint
CREATE TYPE "public"."connection_type" AS ENUM('recruiter', 'referral', 'hiring-manager', 'other');--> statement-breakpoint
CREATE TYPE "public"."lead_status" AS ENUM('new', 'reviewing', 'applied', 'discarded', 'closed');--> statement-breakpoint
CREATE TYPE "public"."outreach_kind" AS ENUM('referral-ask', 'cold-outreach', 'follow-up');--> statement-breakpoint
CREATE TYPE "public"."outreach_status" AS ENUM('draft', 'sent');--> statement-breakpoint
CREATE TYPE "public"."reminder_outcome" AS ENUM('pending', 'reminder-sent', 'response-received', 'closed', 'not-responded');--> statement-breakpoint
CREATE TYPE "public"."resume_file_type" AS ENUM('pdf', 'doc', 'docx');--> statement-breakpoint
CREATE TYPE "public"."task_kind" AS ENUM('follow-up', 'decision', 'manual');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('open', 'done');--> statement-breakpoint
CREATE TABLE "contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"lead_id" uuid NOT NULL,
	"name" text NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"linkedin_url" text,
	"connection_type" "connection_type" NOT NULL,
	"ai_parsed" boolean DEFAULT false NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gmail_config" (
	"user_id" text PRIMARY KEY NOT NULL,
	"senders" text[] DEFAULT '{}'::text[] NOT NULL,
	"label" text,
	"subject_keywords" text,
	"lookback_days" integer DEFAULT 30 NOT NULL,
	"connected" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gmail_ingest_errors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"message_id" text NOT NULL,
	"reason" text NOT NULL,
	"raw_excerpt" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gmail_processed_messages" (
	"user_id" text NOT NULL,
	"message_id" text NOT NULL,
	"processed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gmail_sync_state" (
	"user_id" text PRIMARY KEY NOT NULL,
	"last_history_id" text,
	"last_synced_at" timestamp with time zone,
	"last_run_at" timestamp with time zone,
	"last_error" text
);
--> statement-breakpoint
CREATE TABLE "job_lead_details" (
	"lead_id" uuid PRIMARY KEY NOT NULL,
	"jd_text" text,
	"ai_summary" text,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "job_leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"linkedin_job_id" text NOT NULL,
	"title" text NOT NULL,
	"company" text NOT NULL,
	"location" text NOT NULL,
	"remote" boolean DEFAULT false NOT NULL,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"posted_relative" text NOT NULL,
	"canonical_job_url" text NOT NULL,
	"status" "lead_status" DEFAULT 'new' NOT NULL,
	"close_outcome" "close_outcome",
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source_message_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outreach_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"lead_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"kind" "outreach_kind" NOT NULL,
	"channel" text NOT NULL,
	"status" "outreach_status" DEFAULT 'draft' NOT NULL,
	"draft_body" text NOT NULL,
	"sent_body" text,
	"resume_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "reminders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"lead_id" uuid NOT NULL,
	"outreach_message_id" uuid,
	"sequence" integer NOT NULL,
	"due_date" date NOT NULL,
	"outcome" "reminder_outcome" DEFAULT 'pending' NOT NULL,
	"manual" boolean DEFAULT false NOT NULL,
	"label" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resumes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"label" text NOT NULL,
	"file_name" text NOT NULL,
	"file_type" "resume_file_type" NOT NULL,
	"size_kb" integer NOT NULL,
	"blob_url" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"job_id" uuid NOT NULL,
	"reminder_id" uuid,
	"title" text NOT NULL,
	"kind" "task_kind" NOT NULL,
	"due_date" date,
	"status" "task_status" DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "user_settings" (
	"user_id" text PRIMARY KEY NOT NULL,
	"reminder_interval_days" integer DEFAULT 3 NOT NULL,
	"stale_lead_days" integer DEFAULT 14 NOT NULL,
	"default_resume_id" uuid,
	"ai_provider" "ai_provider" DEFAULT 'openai' NOT NULL,
	"ai_model" text,
	"ai_key_ciphertext" text,
	"ai_key_last4" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"mobile" text,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_lead_id_job_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."job_leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gmail_config" ADD CONSTRAINT "gmail_config_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gmail_ingest_errors" ADD CONSTRAINT "gmail_ingest_errors_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gmail_processed_messages" ADD CONSTRAINT "gmail_processed_messages_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gmail_sync_state" ADD CONSTRAINT "gmail_sync_state_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_lead_details" ADD CONSTRAINT "job_lead_details_lead_id_job_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."job_leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_leads" ADD CONSTRAINT "job_leads_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outreach_messages" ADD CONSTRAINT "outreach_messages_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outreach_messages" ADD CONSTRAINT "outreach_messages_lead_id_job_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."job_leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outreach_messages" ADD CONSTRAINT "outreach_messages_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outreach_messages" ADD CONSTRAINT "outreach_messages_resume_id_resumes_id_fk" FOREIGN KEY ("resume_id") REFERENCES "public"."resumes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_lead_id_job_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."job_leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_outreach_message_id_outreach_messages_id_fk" FOREIGN KEY ("outreach_message_id") REFERENCES "public"."outreach_messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resumes" ADD CONSTRAINT "resumes_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_job_id_job_leads_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."job_leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_reminder_id_reminders_id_fk" FOREIGN KEY ("reminder_id") REFERENCES "public"."reminders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_default_resume_id_resumes_id_fk" FOREIGN KEY ("default_resume_id") REFERENCES "public"."resumes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "contacts_lead_idx" ON "contacts" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "contacts_user_linkedin_url_idx" ON "contacts" USING btree ("user_id","linkedin_url");--> statement-breakpoint
CREATE UNIQUE INDEX "gmail_processed_messages_pk" ON "gmail_processed_messages" USING btree ("user_id","message_id");--> statement-breakpoint
CREATE UNIQUE INDEX "job_leads_user_linkedin_job_id_uq" ON "job_leads" USING btree ("user_id","linkedin_job_id");--> statement-breakpoint
CREATE INDEX "job_leads_user_status_idx" ON "job_leads" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "job_leads_user_captured_idx" ON "job_leads" USING btree ("user_id","captured_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "job_leads_tags_gin_idx" ON "job_leads" USING gin ("tags");--> statement-breakpoint
CREATE INDEX "outreach_lead_idx" ON "outreach_messages" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "outreach_contact_idx" ON "outreach_messages" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "reminders_user_outcome_due_idx" ON "reminders" USING btree ("user_id","outcome","due_date");--> statement-breakpoint
CREATE INDEX "reminders_lead_idx" ON "reminders" USING btree ("lead_id");--> statement-breakpoint
CREATE UNIQUE INDEX "resumes_one_default_per_user_uq" ON "resumes" USING btree ("user_id") WHERE "resumes"."is_default";--> statement-breakpoint
CREATE INDEX "tasks_user_status_due_idx" ON "tasks" USING btree ("user_id","status","due_date");--> statement-breakpoint
CREATE INDEX "tasks_job_idx" ON "tasks" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");