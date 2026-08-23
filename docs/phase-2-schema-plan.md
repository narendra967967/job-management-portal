# Phase 2 — Database Schema Plan

> **Status: PLAN (not yet implemented).** Per the build order, the Drizzle schema
> (`db/schema.ts`) + migrations are written only once Phase 1 UI is signed off.
> This document captures the schema the finished Phase 1 UI revealed, so Phase 2
> is a transcription job, not a redesign. Stack: **Neon Postgres + Drizzle ORM +
> Drizzle Kit**, auth by **Better Auth**.

## Principles
- **Schema follows the UI.** Every column below exists because a Phase 1 screen
  reads or writes it (mapping to `lib/types.ts` noted per table).
- **`user_id` everywhere, single-user for now.** Every app table carries
  `user_id` from day one (avoids a future migration); queries always scope to
  the one owner. Sign-in is allow-listed to one email server-side.
- **Idempotent ingestion.** The Gmail sync runs often (GitHub Actions every
  15–30 min per TRD §2), so re-seeing the same job must be a no-op — enforced by
  a unique key + `ON CONFLICT DO NOTHING` (see “Dedup & incremental sync”).

## Auth tables — owned by Better Auth (not hand-designed)
`users`, `accounts`, `sessions`, `verification` come from Better Auth's Drizzle
adapter. Notes:
- `accounts.scope` includes `gmail.readonly`; `accounts.refresh_token` is what
  the Gmail sync uses — **no separately stored Google credential.**
- App tables' `user_id` → FK to `users.id`.

## Enums (Postgres enums via Drizzle `pgEnum`)
| Enum | Values | Source |
|---|---|---|
| `lead_status` | `new`, `reviewing`, `applied`, `discarded`, `closed` | `LeadStatus` |
| `close_outcome` | `offer`, `rejected`, `withdrawn`, `no-response` | `CloseOutcome` |
| `connection_type` | `recruiter`, `referral`, `hiring-manager`, `other` | `ConnectionType` |
| `outreach_kind` | `referral-ask`, `cold-outreach`, `follow-up` | `OutreachKind` |
| `outreach_status` | `draft`, `sent` | `OutreachStatus` |
| `reminder_outcome` | `pending`, `reminder-sent`, `response-received`, `closed`, `not-responded` | `ReminderOutcome` |
| `task_kind` | `follow-up`, `decision`, `manual` | `TaskKind` |
| `task_status` | `open`, `done` | `Task.status` |
| `ai_provider` | `openai`, `anthropic` | `AiProvider` |

## Application tables

### `job_leads`  (maps `JobLead`)
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid FK → users | scoping |
| `linkedin_job_id` | text NOT NULL | **dedupe key** (parsed from canonical URL) |
| `title`, `company`, `location` | text | |
| `remote` | boolean | |
| `tags` | text[] | |
| `posted_relative` | text | display string from the alert |
| `canonical_job_url` | text | |
| `status` | `lead_status` default `new` | |
| `close_outcome` | `close_outcome` NULL | set only when `status = closed` |
| `captured_at` | timestamptz | when ingested |
| `source_message_id` | text NULL | Gmail message it came from (audit) |
| `created_at` / `updated_at` | timestamptz | |

- **`UNIQUE (user_id, linkedin_job_id)`** ← the anti-flooding constraint.
- Indexes: `(user_id, status)`, `(user_id, captured_at desc)`, GIN on `tags`.
- `contact_count` / `has_due_reminder` from the UI are **derived** (counts /
  EXISTS), not stored.

### `job_lead_details`  (maps `JobLeadDetail`, 1:1 with a lead)
`lead_id` PK/FK · `jd_text` text NULL · `ai_summary` text NULL · `notes` text NULL.

### `contacts`  (maps `Contact`)
`id` PK · `user_id` · `lead_id` FK · `name` · `title` · `linkedin_url` NULL ·
`connection_type` · `ai_parsed` boolean · timestamps. Index `(lead_id)`.

### `outreach_messages`  (maps `OutreachMessage`)
`id` PK · `user_id` · `lead_id` FK · `contact_id` FK · `kind` · `channel` ·
`status` · `draft_body` text · `sent_body` text NULL · `resume_id` FK NULL ·
`created_at` · `sent_at` NULL. Stores both AI draft and final sent (FR-4.4).

### `reminders`  (maps `Reminder`)
`id` PK · `user_id` · `lead_id` FK · `outreach_message_id` FK NULL ·
`sequence` int · `due_date` date · `outcome` `reminder_outcome` default
`pending` · `manual` boolean · `label` text NULL · timestamps.
Index `(user_id, outcome, due_date)` for the due-check cron.

### `tasks`  (maps `Task`) — **UI-revealed addition, see Deviations**
`id` PK · `user_id` · `job_id` FK → job_leads NOT NULL (mandatory) ·
`reminder_id` FK NULL (optional link) · `title` · `kind` `task_kind` ·
`due_date` date NULL · `status` `task_status` default `open` · `created_at` ·
`completed_at` NULL. Index `(user_id, status, due_date)`.

### `resumes`  (maps `Resume`)
`id` PK · `user_id` · `label` · `file_name` · `file_type` · `size_kb` ·
`blob_url` text (Phase 3: Vercel Blob/S3/R2 — Vercel FS is read-only) ·
`is_default` boolean · `updated_at`. Partial unique index so only one
`is_default = true` per user.

### `user_settings`  (single row per user)
`user_id` PK · `reminder_interval_days` int default 3 (FR-5.1) ·
`stale_lead_days` int default 14 (FR-2.4) · `default_resume_id` FK NULL ·
`ai_provider` `ai_provider` · `ai_model` text NULL ·
`ai_key_ciphertext` bytea NULL (**encrypted at rest**) · `ai_key_last4` text NULL
· timestamps. (Backs the Settings “Follow-ups” + “AI provider” cards.)

### `gmail_config`  (single row per user — the ingestion rules)
`user_id` PK · `senders` text[] · `label` text NULL · `subject_keywords` text
NULL · `lookback_days` int default 30 · `connected` boolean · updated_at.
Backs the Settings “Which emails to read” card; the sync builds the Gmail `q`
from these (`buildGmailQuery`).

### `gmail_sync_state`  (single row per user — the incremental cursor)
`user_id` PK · `last_history_id` text NULL (Gmail History API) ·
`last_synced_at` timestamptz NULL · `last_run_at` timestamptz · `last_error`
text NULL. Lets the cron fetch only what changed since last run.

### `gmail_ingest_errors`  (FR-1.7 error queue)
`id` PK · `user_id` · `message_id` text · `reason` text · `raw_excerpt` text ·
`created_at`. Parse failures land here instead of being silently dropped.

### `gmail_processed_messages`  (optional message-level dedupe)
`user_id` + `message_id` (composite PK). Belt-and-braces so a re-delivered
email isn’t re-parsed; the `linkedin_job_id` unique key already prevents
duplicate leads even without this.

## Dedup & incremental sync (the anti-flooding design)
1. **Backfill once:** first run uses `newer_than:{lookback_days}d`.
2. **Incremental after:** use `gmail_sync_state.last_history_id`
   (`users.history.list`) — or fall back to `after:{last_synced_at - overlap}`.
   Never re-scan the full window daily.
3. **Parse → extract `linkedin_job_id`** from the resolved canonical URL
   (`/jobs/view/{id}`). One alert email yields **many** leads → dedupe within
   the batch too.
4. **Insert `ON CONFLICT (user_id, linkedin_job_id) DO NOTHING`** → a job seen
   again (repeat email, window overlap) is ignored. **No flooding.**
5. Advance `last_history_id` / `last_synced_at` only on a fully successful run.

## Deviations from FRD/TRD (flagged for sign-off)
All below were revealed/approved during Phase 1; none silently diverge:
- **`tasks` table** — not in the TRD; added for the To-do module (jobs↔reminders↔tasks) the user requested.
- **`closed` status + `close_outcome`** — beyond the FRD’s 4 statuses; user-approved for job closure.
- **`ai_provider` = openai | anthropic** — TRD specced OpenAI-only; dual-provider is user-approved.
- **`resumes.blob_url`** — resume files go to blob storage (Vercel FS is read-only), not the project folder.
- **`gmail_config` fields** (senders/label/subject/lookback) — make FR-1.1’s “sender/label” restriction user-configurable and verifiable.

## Security (TRD §8) baked into the schema/queries
- Every app query filters by `user_id`; sign-in allow-list is the real single-user guard.
- AI key stored **encrypted** (`ai_key_ciphertext`), only `last4` ever returned to the client.
- Gmail stays **`gmail.readonly`** — no write/send scope ever.
- Cron routes check the bearer secret before any DB work.

## Migration workflow
`db/schema.ts` = single source of truth → `drizzle-kit generate` → review SQL →
`drizzle-kit migrate` against Neon. Seed script optional for local dev.

## Open decisions to confirm before writing `schema.ts`
1. `gmail_config` + `gmail_sync_state` as **two tables** (clean separation) or one `gmail_integration` row? (Plan assumes two.)
2. Keep `gmail_processed_messages`, or rely solely on the `linkedin_job_id` unique key? (Plan includes it as optional.)
3. `tags` as `text[]` (simple) vs a `tags`/`lead_tags` join (queryable) — plan uses `text[]` + GIN, matching the UI’s tag filter.
