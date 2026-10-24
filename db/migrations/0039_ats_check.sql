CREATE TABLE "resume_ats_checks" (
	"resume_id" uuid PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"score" integer NOT NULL,
	"result" jsonb NOT NULL,
	"resume_hash" text NOT NULL,
	"profile_hash" text NOT NULL,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "plans" ADD COLUMN "allow_ats_check" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "resume_ats_checks" ADD CONSTRAINT "resume_ats_checks_resume_id_resumes_id_fk" FOREIGN KEY ("resume_id") REFERENCES "public"."resumes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resume_ats_checks" ADD CONSTRAINT "resume_ats_checks_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;