# Phase 2 — Database Schema Plan

> **Status: IMPLEMENTED.** `db/schema.ts` (single source of truth), the Better
> Auth tables in `db/auth-schema.ts`, and migration `db/migrations/0000_*.sql`
> are written. Apply with `npm run db:migrate` once `DATABASE_URL` is set. This
> document is the design; the sections below note where the built schema
> deviates from the original plan text. Stack: **Neon Postgres + Drizzle ORM +
> Drizzle Kit**, auth by **Better Auth**.
>
> **Deviations found while building (vs. this plan's original text):**
> - **`user_id` is `text`, not `uuid`.** Better Auth's default IDs are `text`, so
>   `user.id` is text and every app-table `user_id` FK is text to match.
> - **AI key stored as `text` (base64 ciphertext), not `bytea`.** Functionally
>   identical for "encrypted at rest"; avoids a custom Drizzle column type.
> - **Added `resume_file_type` enum** (`pdf`/`doc`/`docx`) for `resumes.file_type`.
> - **`job_lead_details` has no `user_id`** (scoped via its 1:1 `lead_id` FK), as
>   this plan's table list specified — the one app table without a `user_id`.
> - **`user.mobile`** added to the Better Auth user table (via `additionalFields`)
>   to back Settings → Profile's mobile field.
> - Workflow: `npm run auth:generate` (Better Auth tables) → `npm run db:generate`
>   (migration) → `npm run db:migrate`.

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
`user`, `account`, `session`, `verification` come from Better Auth's Drizzle
adapter (`db/auth-schema.ts`). Notes:
- App tables' `user_id` → FK to `user.id` (text ids).
- **Login = email + password** (Better Auth `emailAndPassword`, self sign-up
  disabled → admin-provisioned accounts only). Passwords are scrypt-hashed
  (`lib/password.ts`) in the `account` table (`providerId: "credential"`).
- **Google is NOT login.** It is linked from Settings (account linking) to grant
  read-only Gmail; the linked `account` row (`providerId: "google"`) holds the
  `refresh_token` the Gmail sync uses — no separately stored Google credential.
- **Deviation from TRD §8** (owner-directed): the TRD specced Google-only login
  with no password. We use credentials login + Google-for-Gmail-only instead, so
  an admin can provision users and each connects their own Gmail. Multi-user /
  admin dashboard remain deferred; today it's one seeded account.

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
`connection_type` · `ai_parsed` boolean · `added_at` timestamptz · timestamps.
Index `(lead_id)`. `added_at` (UI: `Contact.addedAt`) is what the per-lead
timeline orders "contact added" events by (FR-6.2) — must be a real stored
column, not just `created_at` audit noise. Add `(user_id, linkedin_url)` index
to support the per-contact cross-lead grouping (see Module 6 below).

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

## Module 6 — history & timeline (FR-6.1/6.2) — derived, no new tables
Both Module 6 surfaces the Phase 1 UI added are **read-only projections** over
the tables above; nothing new to persist.
- **FR-6.1 — per-contact history across leads.** Contacts stay lead-scoped
  (one row per person per lead). The Contacts page groups rows into a "person"
  by `linkedin_url` (normalized), falling back to normalized `name` when the URL
  is absent (UI: `contactPersonKey`). Phase 2 query = group contacts by that key,
  left-join `outreach_messages` per contact row. The `(user_id, linkedin_url)`
  index above keeps this cheap. **Not** promoting to a `people`/`lead_contacts`
  split yet — revisit only if a person needs identity/notes independent of a lead.
- **FR-6.2 — per-lead timeline.** A chronological merge of rows that already
  carry timestamps: `job_leads.captured_at`, `contacts.added_at`,
  `outreach_messages.sent_at`/`created_at`, `reminders.due_date` + outcome, with
  the current `status`/`close_outcome` as the closing state. Status *transitions*
  are not individually timestamped today, so they aren't dated in the timeline —
  if a fully dated audit trail is ever wanted, add a `lead_events` table written
  on each mutation; deferred as out of scope for now.

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
`drizzle-kit migrate`. Seed script optional for local dev.

## Local development (current — no cloud DB yet)
Decision (2026-09-18): build and test entirely against a **local Postgres in
Docker** first; online hosting is decided later. On this machine port 5432 was
already taken by another project, so JMP uses **5433**.
- `docker-compose.yml` runs `postgres:17-alpine` as `jmp-postgres` (db/user/pass
  all `jmp` / `jmp_local_dev`), data in the `jmp_pgdata` volume.
- `.env.local` (gitignored) holds `DATABASE_URL=postgresql://jmp:jmp_local_dev@localhost:5433/jmp`.
- **Runtime driver deviation:** `lib/db.ts` uses **node-postgres (`pg`)**, not
  Neon's serverless HTTP driver (TRD §2) — the Neon driver can't reach a local
  Postgres. Going online later is a one-file change in `lib/db.ts`.
- Commands: `docker compose up -d` → `npm run db:migrate`. Reset all data with
  `docker compose down -v`. Browse with `npm run db:studio`.

## Open decisions to confirm before writing `schema.ts`
1. `gmail_config` + `gmail_sync_state` as **two tables** (clean separation) or one `gmail_integration` row? (Plan assumes two.)
2. Keep `gmail_processed_messages`, or rely solely on the `linkedin_job_id` unique key? (Plan includes it as optional.)
3. `tags` as `text[]` (simple) vs a `tags`/`lead_tags` join (queryable) — plan uses `text[]` + GIN, matching the UI’s tag filter.
