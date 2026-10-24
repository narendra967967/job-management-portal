CREATE TABLE "career_profiles" (
	"user_id" text PRIMARY KEY NOT NULL,
	"current_title" text DEFAULT '' NOT NULL,
	"city" text DEFAULT '' NOT NULL,
	"years_experience" integer,
	"linkedin_url" text DEFAULT '' NOT NULL,
	"portfolio_url" text DEFAULT '' NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"skills" text[] DEFAULT '{}'::text[] NOT NULL,
	"tools" text[] DEFAULT '{}'::text[] NOT NULL,
	"languages" text[] DEFAULT '{}'::text[] NOT NULL,
	"work_countries" text[] DEFAULT '{}'::text[] NOT NULL,
	"needs_sponsorship" boolean,
	"sponsorship_countries" text[] DEFAULT '{}'::text[] NOT NULL,
	"target_roles" text[] DEFAULT '{}'::text[] NOT NULL,
	"seniority" text DEFAULT '' NOT NULL,
	"work_modes" text[] DEFAULT '{}'::text[] NOT NULL,
	"preferred_locations" text[] DEFAULT '{}'::text[] NOT NULL,
	"employment_types" text[] DEFAULT '{}'::text[] NOT NULL,
	"industries" text[] DEFAULT '{}'::text[] NOT NULL,
	"open_to_relocate" boolean,
	"notice_period" text DEFAULT '' NOT NULL,
	"current_pay_amount" integer,
	"current_pay_currency" text,
	"current_pay_period" text,
	"expected_pay_amount" integer,
	"expected_pay_currency" text,
	"expected_pay_period" text,
	"gender" text DEFAULT '' NOT NULL,
	"disability" text DEFAULT '' NOT NULL,
	"veteran" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "certifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"name" text NOT NULL,
	"issuer" text DEFAULT '' NOT NULL,
	"year" integer,
	"url" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "educations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"degree" text NOT NULL,
	"field" text DEFAULT '' NOT NULL,
	"institution" text NOT NULL,
	"start_year" integer,
	"end_year" integer,
	"grade" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "work_experiences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"title" text NOT NULL,
	"company" text NOT NULL,
	"location" text DEFAULT '' NOT NULL,
	"employment_type" text DEFAULT '' NOT NULL,
	"start_month" integer,
	"start_year" integer,
	"end_month" integer,
	"end_year" integer,
	"is_current" boolean DEFAULT false NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "career_profiles" ADD CONSTRAINT "career_profiles_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certifications" ADD CONSTRAINT "certifications_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "educations" ADD CONSTRAINT "educations_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_experiences" ADD CONSTRAINT "work_experiences_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "certifications_user_order_idx" ON "certifications" USING btree ("user_id","sort_order");--> statement-breakpoint
CREATE INDEX "educations_user_order_idx" ON "educations" USING btree ("user_id","sort_order");--> statement-breakpoint
CREATE INDEX "work_experiences_user_order_idx" ON "work_experiences" USING btree ("user_id","sort_order");