CREATE TYPE "public"."guide_status" AS ENUM('active', 'inactive');--> statement-breakpoint
CREATE TABLE "guide_topics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"icon" text DEFAULT 'book-open' NOT NULL,
	"group_name" text DEFAULT 'General' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"status" "guide_status" DEFAULT 'inactive' NOT NULL,
	"in_progress" boolean DEFAULT false NOT NULL,
	"sections" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updated_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "guide_topics" ADD CONSTRAINT "guide_topics_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "guide_topics_slug_uq" ON "guide_topics" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "guide_topics_status_order_idx" ON "guide_topics" USING btree ("status","sort_order");--> statement-breakpoint
-- Seed: the guides that shipped as static content, so /guides isn't empty after
-- the switch to admin-managed guides. Skips any slug that already exists.
INSERT INTO "guide_topics" ("slug", "title", "summary", "icon", "group_name", "sort_order", "status", "in_progress", "sections") VALUES
('getting-started', 'Getting started', 'What Jobtiva does and the first things to set up.', 'rocket', 'Start here', 10, 'active', true, '[{"heading":"What this guide will cover","blocks":[{"type":"callout","tone":"note","text":"This guide is being written. Meanwhile, use **Help & support** if you get stuck — we reply quickly."}]}]'::jsonb),
('ai-key', 'Set up your AI key', 'Connect OpenAI, Anthropic or OpenRouter so AI features work.', 'sparkles', 'Start here', 20, 'active', true, '[{"heading":"Why you need it","blocks":[{"type":"text","text":"Jobtiva''s AI features — job-description summaries, fit scores, outreach drafts and salary insights — run on **your own AI account**. You add an API key once; it''s encrypted and only its last 4 characters are ever shown back."}]},{"heading":"Add your key","blocks":[{"type":"steps","steps":[{"title":"Create an API key with your AI provider","detail":"Step-by-step for each provider is coming in this guide."},{"title":"Open Settings → AI provider","detail":"Pick the same provider you created the key with."},{"title":"Paste the key and save","detail":"You''ll see the last 4 characters once it''s stored."},{"title":"Try it","detail":"Open a job, paste its description and choose Save & Summarize with AI."}]},{"type":"links","links":[{"label":"Open Settings → AI provider","href":"/settings?tab=ai"}]},{"type":"callout","tone":"warning","title":"Keep your key private","text":"Never share it in emails or support tickets. If you think it leaked, delete it in your provider''s dashboard and add a new one here."}]},{"heading":"Watch how","blocks":[{"type":"video","title":"Setting up your AI key","url":""}]}]'::jsonb),
('gmail', 'Connect Gmail & sync jobs', 'Bring job alerts in automatically, and pause syncing when you need to.', 'mail', 'Start here', 30, 'active', true, '[{"heading":"What this guide will cover","blocks":[{"type":"callout","tone":"note","text":"This guide is being written. Meanwhile, use **Help & support** if you get stuck — we reply quickly."}]}]'::jsonb),
('leads', 'Work your leads', 'Statuses, Top Choice, the board, filters and automatic status updates.', 'briefcase', 'Your job search', 40, 'active', true, '[{"heading":"What this guide will cover","blocks":[{"type":"callout","tone":"note","text":"This guide is being written. Meanwhile, use **Help & support** if you get stuck — we reply quickly."}]}]'::jsonb),
('outreach', 'Contacts & outreach', 'Add recruiters and referrals, draft messages, mark them sent.', 'send', 'Your job search', 50, 'active', true, '[{"heading":"What this guide will cover","blocks":[{"type":"callout","tone":"note","text":"This guide is being written. Meanwhile, use **Help & support** if you get stuck — we reply quickly."}]}]'::jsonb),
('follow-ups', 'Reminders & follow-ups', 'How follow-ups are scheduled and chained, and what To-do shows.', 'bell', 'Your job search', 60, 'active', true, '[{"heading":"What this guide will cover","blocks":[{"type":"callout","tone":"note","text":"This guide is being written. Meanwhile, use **Help & support** if you get stuck — we reply quickly."}]}]'::jsonb),
('resumes', 'Résumés & fit score', 'Upload résumés, set a default, and score how well you fit a job.', 'file-text', 'Your job search', 70, 'active', true, '[{"heading":"What this guide will cover","blocks":[{"type":"callout","tone":"note","text":"This guide is being written. Meanwhile, use **Help & support** if you get stuck — we reply quickly."}]}]'::jsonb),
('premium', 'Plans & premium features', 'Notes, salary insight, and how to upgrade your plan.', 'crown', 'Account', 80, 'active', true, '[{"heading":"What this guide will cover","blocks":[{"type":"callout","tone":"note","text":"This guide is being written. Meanwhile, use **Help & support** if you get stuck — we reply quickly."}]}]'::jsonb)
ON CONFLICT ("slug") DO NOTHING;
