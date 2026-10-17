ALTER TABLE "guide_topics" ADD COLUMN "content_html" text DEFAULT '' NOT NULL;
--> statement-breakpoint
-- Convert the old sections/blocks JSON of the seeded guides to HTML (only rows not yet converted).
UPDATE "guide_topics" SET "content_html" = '<h2>What this guide will cover</h2>
<blockquote>
<p><strong>Note</strong></p>
<p>This guide is being written. Meanwhile, use <strong>Help &amp; support</strong> if you get stuck — we reply quickly.</p>
</blockquote>' WHERE "slug" = 'getting-started' AND "content_html" = '';--> statement-breakpoint
UPDATE "guide_topics" SET "content_html" = '<h2>Why you need it</h2>
<p>Jobtiva''s AI features — job-description summaries, fit scores, outreach drafts and salary insights — run on <strong>your own AI account</strong>. You add an API key once; it''s encrypted and only its last 4 characters are ever shown back.</p>
<h2>Add your key</h2>
<ol>
<li><strong>Create an API key with your AI provider</strong><br>Step-by-step for each provider is coming in this guide.</li>
<li><strong>Open Settings → AI provider</strong><br>Pick the same provider you created the key with.</li>
<li><strong>Paste the key and save</strong><br>You''ll see the last 4 characters once it''s stored.</li>
<li><strong>Try it</strong><br>Open a job, paste its description and choose Save &amp; Summarize with AI.</li>
</ol>
<p><a href="/settings?tab=ai">Open Settings → AI provider →</a></p>
<blockquote>
<p><strong>Keep your key private</strong></p>
<p>Never share it in emails or support tickets. If you think it leaked, delete it in your provider''s dashboard and add a new one here.</p>
</blockquote>
<h2>Watch how</h2>
<p><em>Video coming soon: Setting up your AI key</em></p>' WHERE "slug" = 'ai-key' AND "content_html" = '';--> statement-breakpoint
UPDATE "guide_topics" SET "content_html" = '<h2>What this guide will cover</h2>
<blockquote>
<p><strong>Note</strong></p>
<p>This guide is being written. Meanwhile, use <strong>Help &amp; support</strong> if you get stuck — we reply quickly.</p>
</blockquote>' WHERE "slug" = 'gmail' AND "content_html" = '';--> statement-breakpoint
UPDATE "guide_topics" SET "content_html" = '<h2>What this guide will cover</h2>
<blockquote>
<p><strong>Note</strong></p>
<p>This guide is being written. Meanwhile, use <strong>Help &amp; support</strong> if you get stuck — we reply quickly.</p>
</blockquote>' WHERE "slug" = 'leads' AND "content_html" = '';--> statement-breakpoint
UPDATE "guide_topics" SET "content_html" = '<h2>What this guide will cover</h2>
<blockquote>
<p><strong>Note</strong></p>
<p>This guide is being written. Meanwhile, use <strong>Help &amp; support</strong> if you get stuck — we reply quickly.</p>
</blockquote>' WHERE "slug" = 'outreach' AND "content_html" = '';--> statement-breakpoint
UPDATE "guide_topics" SET "content_html" = '<h2>What this guide will cover</h2>
<blockquote>
<p><strong>Note</strong></p>
<p>This guide is being written. Meanwhile, use <strong>Help &amp; support</strong> if you get stuck — we reply quickly.</p>
</blockquote>' WHERE "slug" = 'follow-ups' AND "content_html" = '';--> statement-breakpoint
UPDATE "guide_topics" SET "content_html" = '<h2>What this guide will cover</h2>
<blockquote>
<p><strong>Note</strong></p>
<p>This guide is being written. Meanwhile, use <strong>Help &amp; support</strong> if you get stuck — we reply quickly.</p>
</blockquote>' WHERE "slug" = 'resumes' AND "content_html" = '';--> statement-breakpoint
UPDATE "guide_topics" SET "content_html" = '<h2>What this guide will cover</h2>
<blockquote>
<p><strong>Note</strong></p>
<p>This guide is being written. Meanwhile, use <strong>Help &amp; support</strong> if you get stuck — we reply quickly.</p>
</blockquote>' WHERE "slug" = 'premium' AND "content_html" = '';
