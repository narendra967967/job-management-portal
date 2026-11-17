CREATE TYPE "public"."ai_interview_status" AS ENUM('pending_payment', 'ready', 'in_progress', 'interrupted', 'completed', 'stopped', 'failed', 'expired');--> statement-breakpoint
ALTER TYPE "public"."order_kind" ADD VALUE 'ai_interview';--> statement-breakpoint
CREATE TABLE "ai_interview_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"interview_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"detail" text DEFAULT '' NOT NULL,
	"clock_seconds" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_interview_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"interview_id" uuid NOT NULL,
	"seq" integer NOT NULL,
	"sender" text NOT NULL,
	"kind" text NOT NULL,
	"question_no" smallint,
	"text" text NOT NULL,
	"clock_seconds" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_interview_messages_sender_ck" CHECK ("ai_interview_messages"."sender" in ('ai', 'candidate')),
	CONSTRAINT "ai_interview_messages_kind_ck" CHECK ("ai_interview_messages"."kind" in ('question', 'follow_up', 'answer', 'closing'))
);
--> statement-breakpoint
CREATE TABLE "ai_interviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"status" "ai_interview_status" DEFAULT 'ready' NOT NULL,
	"role" text NOT NULL,
	"industry" text NOT NULL,
	"category" text NOT NULL,
	"difficulty" text NOT NULL,
	"duration_min" integer NOT NULL,
	"topics" text[] DEFAULT '{}'::text[] NOT NULL,
	"lead_id" uuid,
	"lead_label" text,
	"resume_id" uuid,
	"resume_source" text NOT NULL,
	"resume_label" text DEFAULT '' NOT NULL,
	"resume_text" text DEFAULT '' NOT NULL,
	"job_description_source" text NOT NULL,
	"job_description" text DEFAULT '' NOT NULL,
	"coverage" text NOT NULL,
	"plan_name" text,
	"allowance_period_ends" timestamp with time zone,
	"price_full_paise" integer DEFAULT 0 NOT NULL,
	"price_paise" integer DEFAULT 0 NOT NULL,
	"discount_percent" integer DEFAULT 0 NOT NULL,
	"credited_from_id" uuid,
	"credited_by" text,
	"credit_note" text,
	"valid_until" timestamp with time zone NOT NULL,
	"expiry_reminder_sent_at" timestamp with time zone,
	"settings" jsonb NOT NULL,
	"question_plan" jsonb,
	"questions_asked" integer DEFAULT 0 NOT NULL,
	"active_seconds" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone,
	"last_active_at" timestamp with time zone,
	"interrupted_at" timestamp with time zone,
	"wrap_up_started_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"end_reason" text,
	"ai_provider" "ai_provider",
	"ai_model" text,
	"tokens_in" integer DEFAULT 0 NOT NULL,
	"tokens_out" integer DEFAULT 0 NOT NULL,
	"ai_cost_paise" real DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_interviews_difficulty_ck" CHECK ("ai_interviews"."difficulty" in ('Easy', 'Medium', 'Hard')),
	CONSTRAINT "ai_interviews_duration_ck" CHECK ("ai_interviews"."duration_min" between 5 and 60),
	CONSTRAINT "ai_interviews_coverage_ck" CHECK ("ai_interviews"."coverage" in ('plan', 'free', 'paid', 'credit')),
	CONSTRAINT "ai_interviews_resume_source_ck" CHECK ("ai_interviews"."resume_source" in ('saved', 'upload', 'paste')),
	CONSTRAINT "ai_interviews_jd_source_ck" CHECK ("ai_interviews"."job_description_source" in ('lead', 'paste', 'none')),
	CONSTRAINT "ai_interviews_money_ck" CHECK ("ai_interviews"."price_full_paise" >= 0 and "ai_interviews"."price_paise" >= 0 and "ai_interviews"."price_paise" <= "ai_interviews"."price_full_paise" and "ai_interviews"."discount_percent" between 0 and 100),
	CONSTRAINT "ai_interviews_credit_ck" CHECK ("ai_interviews"."coverage" <> 'credit' or ("ai_interviews"."credited_from_id" is not null and length("ai_interviews"."credit_note") >= 10))
);
--> statement-breakpoint
CREATE TABLE "interview_evaluations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"source" text NOT NULL,
	"ai_interview_id" uuid,
	"status" text DEFAULT 'draft' NOT NULL,
	"evaluator_name" text,
	"communication" smallint,
	"technical" smallint,
	"confidence" smallint,
	"problem_solving" smallint,
	"relevance" smallint,
	"weights" jsonb,
	"overall" smallint,
	"writing" jsonb,
	"submitted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "interview_evaluations_source_ck" CHECK ("interview_evaluations"."source" in ('ai', 'human')),
	CONSTRAINT "interview_evaluations_status_ck" CHECK ("interview_evaluations"."status" in ('draft', 'submitted')),
	CONSTRAINT "interview_evaluations_scores_ck" CHECK (coalesce("interview_evaluations"."communication", 1) between 1 and 10 and coalesce("interview_evaluations"."technical", 1) between 1 and 10
        and coalesce("interview_evaluations"."confidence", 1) between 1 and 10 and coalesce("interview_evaluations"."problem_solving", 1) between 1 and 10
        and coalesce("interview_evaluations"."relevance", 1) between 1 and 10 and coalesce("interview_evaluations"."overall", 0) between 0 and 100),
	CONSTRAINT "interview_evaluations_submitted_ck" CHECK ("interview_evaluations"."status" <> 'submitted' or ("interview_evaluations"."communication" is not null and "interview_evaluations"."technical" is not null and "interview_evaluations"."confidence" is not null
        and "interview_evaluations"."problem_solving" is not null and "interview_evaluations"."relevance" is not null and "interview_evaluations"."overall" is not null and "interview_evaluations"."writing" is not null
        and "interview_evaluations"."submitted_at" is not null))
);
--> statement-breakpoint
CREATE TABLE "mock_interview_config" (
	"id" text PRIMARY KEY DEFAULT 'app' NOT NULL,
	"ai_state" text DEFAULT 'coming_soon' NOT NULL,
	"human_state" text DEFAULT 'coming_soon' NOT NULL,
	"applications_open" boolean DEFAULT false NOT NULL,
	"pause_bookings" boolean DEFAULT false NOT NULL,
	"ai_provider" "ai_provider" DEFAULT 'openai' NOT NULL,
	"ai_model" text,
	"ai_key_ciphertext" text,
	"ai_key_last4" text,
	"ai_last_test_ok" boolean,
	"ai_last_test_at" timestamp with time zone,
	"categories" text[] DEFAULT '{}'::text[] NOT NULL,
	"durations" integer[] DEFAULT '{15,30,45,60}'::integer[] NOT NULL,
	"minutes_per_question" real DEFAULT 2 NOT NULL,
	"wrap_up_minutes" integer DEFAULT 10 NOT NULL,
	"resume_window_minutes" integer DEFAULT 15 NOT NULL,
	"pace_grace_minutes" integer DEFAULT 5 NOT NULL,
	"booking_valid_days" integer DEFAULT 30 NOT NULL,
	"expiry_reminder_days" integer DEFAULT 3 NOT NULL,
	"pricing" jsonb NOT NULL,
	"weights" jsonb NOT NULL,
	"prompt_question_plan" text,
	"prompt_interviewer" text,
	"prompt_evaluation" text,
	"updated_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mic_states_ck" CHECK ("mock_interview_config"."ai_state" in ('open', 'coming_soon') and "mock_interview_config"."human_state" in ('open', 'coming_soon')),
	CONSTRAINT "mic_numbers_ck" CHECK ("mock_interview_config"."minutes_per_question" between 1 and 5 and "mock_interview_config"."wrap_up_minutes" between 0 and 20 and "mock_interview_config"."resume_window_minutes" between 5 and 60
        and "mock_interview_config"."pace_grace_minutes" between 0 and 15 and "mock_interview_config"."booking_valid_days" between 1 and 365
        and "mock_interview_config"."expiry_reminder_days" >= 0 and "mock_interview_config"."expiry_reminder_days" < "mock_interview_config"."booking_valid_days")
);
--> statement-breakpoint
ALTER TABLE "payment_orders" ALTER COLUMN "period" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_orders" ADD COLUMN "ai_interview_id" uuid;--> statement-breakpoint
ALTER TABLE "plans" ADD COLUMN "ai_interviews_included" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "retention_config" ADD COLUMN "ai_interview_event_days" integer DEFAULT 365 NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_interview_events" ADD CONSTRAINT "ai_interview_events_interview_id_ai_interviews_id_fk" FOREIGN KEY ("interview_id") REFERENCES "public"."ai_interviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_interview_messages" ADD CONSTRAINT "ai_interview_messages_interview_id_ai_interviews_id_fk" FOREIGN KEY ("interview_id") REFERENCES "public"."ai_interviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_interviews" ADD CONSTRAINT "ai_interviews_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_interviews" ADD CONSTRAINT "ai_interviews_lead_id_job_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."job_leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_interviews" ADD CONSTRAINT "ai_interviews_resume_id_resumes_id_fk" FOREIGN KEY ("resume_id") REFERENCES "public"."resumes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_interviews" ADD CONSTRAINT "ai_interviews_credited_from_id_ai_interviews_id_fk" FOREIGN KEY ("credited_from_id") REFERENCES "public"."ai_interviews"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_interviews" ADD CONSTRAINT "ai_interviews_credited_by_user_id_fk" FOREIGN KEY ("credited_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_evaluations" ADD CONSTRAINT "interview_evaluations_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_evaluations" ADD CONSTRAINT "interview_evaluations_ai_interview_id_ai_interviews_id_fk" FOREIGN KEY ("ai_interview_id") REFERENCES "public"."ai_interviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mock_interview_config" ADD CONSTRAINT "mock_interview_config_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_interview_events_interview_idx" ON "ai_interview_events" USING btree ("interview_id","created_at");--> statement-breakpoint
CREATE INDEX "ai_interview_events_created_idx" ON "ai_interview_events" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_interview_messages_seq_uq" ON "ai_interview_messages" USING btree ("interview_id","seq");--> statement-breakpoint
CREATE INDEX "ai_interviews_user_created_idx" ON "ai_interviews" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "ai_interviews_created_idx" ON "ai_interviews" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "ai_interviews_status_valid_idx" ON "ai_interviews" USING btree ("status","valid_until");--> statement-breakpoint
CREATE INDEX "ai_interviews_user_period_idx" ON "ai_interviews" USING btree ("user_id","allowance_period_ends");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_interviews_credited_from_uq" ON "ai_interviews" USING btree ("credited_from_id");--> statement-breakpoint
CREATE UNIQUE INDEX "interview_evaluations_ai_uq" ON "interview_evaluations" USING btree ("ai_interview_id");--> statement-breakpoint
CREATE INDEX "interview_evaluations_user_submitted_idx" ON "interview_evaluations" USING btree ("user_id","submitted_at" DESC NULLS LAST);--> statement-breakpoint
ALTER TABLE "payment_orders" ADD CONSTRAINT "payment_orders_ai_interview_id_ai_interviews_id_fk" FOREIGN KEY ("ai_interview_id") REFERENCES "public"."ai_interviews"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "payment_orders_ai_interview_paid_uq" ON "payment_orders" USING btree ("ai_interview_id") WHERE "payment_orders"."status" = 'paid';--> statement-breakpoint
ALTER TABLE "payment_orders" ADD CONSTRAINT "payment_orders_kind_period_ck" CHECK (("payment_orders"."kind"::text = 'ai_interview' and "payment_orders"."period" is null) or ("payment_orders"."kind"::text <> 'ai_interview' and "payment_orders"."period" is not null));