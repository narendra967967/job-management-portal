ALTER TABLE "kb_messages" ADD COLUMN "outcome" text;--> statement-breakpoint
ALTER TABLE "kb_questions" ADD COLUMN "partial" boolean DEFAULT false NOT NULL;