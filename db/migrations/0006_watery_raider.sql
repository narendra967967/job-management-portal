CREATE TABLE "fit_scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"lead_id" uuid NOT NULL,
	"resume_id" uuid NOT NULL,
	"score" integer NOT NULL,
	"rationale" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "resumes" ADD COLUMN "resume_text" text;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "prompt_score" text;--> statement-breakpoint
ALTER TABLE "fit_scores" ADD CONSTRAINT "fit_scores_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fit_scores" ADD CONSTRAINT "fit_scores_lead_id_job_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."job_leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fit_scores" ADD CONSTRAINT "fit_scores_resume_id_resumes_id_fk" FOREIGN KEY ("resume_id") REFERENCES "public"."resumes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "fit_scores_user_lead_resume_uq" ON "fit_scores" USING btree ("user_id","lead_id","resume_id");