CREATE TABLE "other_answer_reviews" (
	"field" text NOT NULL,
	"value_key" text NOT NULL,
	"status" text NOT NULL,
	"updated_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "other_answer_reviews_field_value_key_pk" PRIMARY KEY("field","value_key"),
	CONSTRAINT "other_answer_reviews_status_ck" CHECK ("other_answer_reviews"."status" in ('added', 'not_adding'))
);
--> statement-breakpoint
ALTER TABLE "ai_interviews" ADD COLUMN "industry_other" text;--> statement-breakpoint
ALTER TABLE "other_answer_reviews" ADD CONSTRAINT "other_answer_reviews_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;