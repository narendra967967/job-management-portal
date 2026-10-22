# Email forwarding — spec (Phase 1)

Status: **approved scope, 2026-10-22** (D1 revised the same day; phases reordered UI → DB on 2026-10-23). Adds email forwarding as the main intake; "Connect Gmail" (Google OAuth, `gmail.readonly`) stays behind an admin on/off switch.
Jobtiva receives job-alert emails that users **forward** to a private address, so it needs **no Google
permission at all**: no OAuth verification, no paid CASA assessment, no 100-user cap, no "unverified app"
screen. Pattern used by e.g. TripIt (`plans@tripit.com`).

## 1. Decisions

| # | Decision |
|---|---|
| D1 | **Keep "Connect Gmail", behind an admin on/off switch** (A6). Active = everything works as today. Inactive = the whole option disappears, sync stops, and **every existing connection is broken** (tokens revoked at Google + deleted). Default: active. *(Revised 2026-10-22 — was "remove".)* |
| D2 | Address = random token only: `k7f2m9x4p3@in.jobtiva.in` (no names — unguessable). |
| D3 | Domains: **`in.jobtiva.in`** (prod), **`in.preprod.jobtiva.in`** (preprod). Local dev: no SMTP; a dev-only "simulate email" path. |
| D4 | **LinkedIn job alerts at launch.** Other senders can be allowed by an admin (config) but need a parser (code) — until then they're logged as *Unsupported format*. |
| D5 | **Free for every plan** (it's the core intake). |
| D6 | New dependencies approved: `smtp-server` (receive), `mailparser` (read MIME), `mailauth` (DKIM/ARC verification). |

## 2. How it works

**One-time setup (user, ~2 min):** Jobtiva shows the address → user adds it in Gmail → Settings →
Forwarding → Gmail emails a confirmation code to the address → Jobtiva receives it and shows the code →
user pastes it into Gmail → user creates one filter *From LinkedIn alerts → Forward to the address*.
Gmail keeps the original in the inbox.

**Every alert (automatic):** LinkedIn → user's Gmail → filter forwards → MX for `in.jobtiva.in` → Jobtiva
mail receiver → safety checks → existing LinkedIn parser → lead (seconds, no 15-minute sync wait).

### Sender trust (generic, not hard-coded to LinkedIn)
An email becomes leads only if **all** hold:
1. the recipient token belongs to an active user and forwarding is enabled;
2. the email is **DKIM-signed by an allowed signing domain** (e.g. `linkedin.com`) — or, if forwarding
   broke the original signature, Gmail's **ARC** seal attests the original DKIM passed;
3. its `From` matches an **allowed sender** entry for that domain;
4. a **parser** exists for that sender (`linkedin` today). Allowed-but-no-parser → logged *Unsupported
   format*, not silently dropped.

Gmail's confirmation email is a special case: `From: forwarding-noreply@google.com`, DKIM `google.com`;
the code is read from the subject and stored on the user's address row (shown in Settings, expires 7 days).

Adding a new site later = admin adds the sender + signing domain (no code) **and** we add one parser file
(code, a few hours, written from a real sample).

## 3. Admin side (separate admin module — no shared templates with the user side)

| # | Feature | Acceptance |
|---|---|---|
| A1 | **Settings → Email forwarding:** on/off; receiving domain (read-only, from env); max email size (default 2 MB) | Off → receiver rejects all mail with a temporary error; setting persists |
| A2 | **Allowed senders:** list of {sender address or `*@domain`, signing domain, parser, enabled}. Seeded with LinkedIn alert senders | Add/edit/disable/delete; Zod-validated; at least one enabled entry required to receive |
| A3 | **Dashboard → "Forwarding health"** (replaces "Gmail health"): received / accepted / rejected for 24 h and 7 d, top rejection reasons, last email received, users set up vs not | Numbers match the log table |
| A4 | **Users:** per-user forwarding status (address created · Gmail confirmed · first alert · last alert) and **Reset address** | Reset makes the old address reject immediately |
| A5 | **Operations → Inbound email log:** time, user, sender, status, reason, size. **No content, no subject** for rejected mail. Kept 30 days | Filter by status/user; auto-purged after 30 days |
| A6 | **Settings → Email intake → "Connect Gmail" switch**, with a confirmation dialog both ways. Off dialog states how many users get disconnected; on dialog warns about Google's 100-user cap / unverified-app screen | See §4a for exact effects; switching is logged (who, when) |

### 4a. Connect Gmail switch — effects

| Area | Active | Inactive |
|---|---|---|
| User Settings → **Gmail connection** and **Sync schedule** tabs | shown | hidden |
| Admin Settings → Cron & schedule → **Gmail sync / quiet hours** section | shown | hidden (lead retention/purge section stays) |
| Saved schedule values (each user's sync interval and pause, admin quiet hours) | used | **kept, not deleted** — back in effect when switched on again |
| Scheduled Gmail sync (cron) and "Sync now" | run | skip every user |
| Linking a Google account | works | **rejected server-side** (Better Auth hook + actions), not just hidden |
| Existing connections | kept | **all broken on switch-off:** each token revoked at Google, then the `account` rows (provider `google`) deleted. Leads stay |
| Admin dashboard Gmail widgets | shown | hidden (Forwarding health stays) |
| Home FAQ / Privacy Gmail sections | shown | hidden — public pages describe only what's active |

Switching back on doesn't restore connections — each user reconnects. Turning it off runs as a background
job (revokes can take a few seconds per user) and reports progress/result to the admin.

## 4. User side (mobile-first: 375 / 768 px)

| # | Feature | Acceptance |
|---|---|---|
| U1 | **Settings → Email forwarding** (replaces "Gmail connection"): address + Copy | Address created on first visit; copy works on mobile |
| U2 | **Setup guide:** 3 illustrated steps (add address · confirm code · create filter), with the exact filter values to copy | Followable without outside help |
| U3 | **Confirmation code panel:** shows Gmail's code when it arrives (auto-refresh), with "copy" | Appears within ~10 s of Gmail sending it |
| U4 | **Status:** *Waiting for Gmail confirmation* → *Waiting for first alert* → *✓ Working · last alert 2 h ago* | Driven by the address row timestamps |
| U5 | **Reset my address** (confirm dialog) | New address shown; reminder to update the Gmail filter |
| U6 | **Ingestion issues** (existing): forwarded emails that couldn't be read — subject only (only for accepted, verified senders) | Unsupported/unparseable alerts listed |
| U7 | **Leads empty state / banner** when forwarding isn't set up | Links to Settings → Email forwarding |
| U8 | **Can't auto-forward?** note for company-managed (Google Workspace) accounts whose admin blocks external forwarding — points **only** to manual forwarding (forward an alert by hand to the same address) or **Add with AI** | Shown in the setup guide; no other workaround offered |

"Gmail connection" and "Sync schedule" stay, but only while the admin's Connect Gmail switch is active
(§4a). Email forwarding (U1–U7) works either way; both can run side by side. Lead **retention/purge** stays.

## 5. Data model (Phase 3 — migration `0030_email_intake`)

New (enums `inbound_status`, `inbound_parser`):
- **`inbound_addresses`** — `user_id` (PK, FK → user, cascade), `token` (unique, random), `created_at`,
  `gmail_code`, `gmail_code_at`, `confirmed_at`, `first_received_at`, `last_received_at`, `updated_at`.
  `confirmed_at` is set when the user clicks **"I've verified it in Gmail"** under the code (Phase 4 adds
  that button — Gmail doesn't tell us), or automatically at the first accepted alert.
- **`inbound_email_log`** — `id`, `received_at`, `user_id` (nullable = unknown recipient; cascade on user
  delete), `from_address` (**accepted job-site mail only**), `from_domain` (always — the only sender info
  for rejected mail), `signing_domain`, `status` (`accepted | rejected | unsupported | duplicate |
  gmail_code`), `reason`, `size_bytes`, `message_id`, `leads_created`. Indexes on `received_at` (30-day
  purge) and (`user_id`, `received_at`). **No `env` column:** prod and preprod each have their own
  database, so each admin panel shows its own log — the Phase 2 "Prod + preprod" filter is dropped in
  Phase 4.
- **`email_intake_config`** (one row `id = 'app'`, like `cron_config`) — `forwarding_enabled` (true),
  `gmail_oauth_enabled` (true), `max_bytes` (2 MB), `gmail_toggled_at`, `gmail_toggled_by` (FK → user,
  set null), `updated_at`. Seeded.
- **`inbound_senders`** — `id`, `match` (unique, lowercase: `jobalerts-noreply@linkedin.com` or
  `*@domain`), `signing_domain`, `parser` (`linkedin` | `none`, default `none`), `enabled`, timestamps.
  Seeded with the 3 LinkedIn alert senders.

Verified 2026-10-23: fresh DB 0000→0030; a copy of local data (6 users, 279 leads intact); constraint and
cascade tests (duplicate token / second address / unknown user / duplicate sender / bad enum rejected;
deleting a user removes their address and log rows, nulls `gmail_toggled_by`, keeps anonymous rows).

Reused as-is: `gmail_processed_messages` (dedupe by RFC `Message-ID`, **shared by both intake paths** so
an alert arriving via Connect Gmail *and* forwarding is processed once — no false "Re-newed" tag),
`gmail_ingest_errors` (parse issues), `job_leads` (`origin = 'system'`, `source` from URL).

Nothing is removed (D1 revised): `gmail_config`, `gmail_sync_state`, `user_settings.sync_interval_hours`
and the quiet-hours columns of `cron_config` stay for the Connect Gmail feature. Switching it off deletes
only Google `account` rows (after revoking their tokens).

## 6. Architecture (Phase 4)

```
Gmail ──SMTP:25 (STARTTLS)──► mail-in container (smtp-server)
                               │ accepts RCPT only for <token>@in.jobtiva.in / in.preprod.jobtiva.in
                               │ size cap, timeouts, connection & per-token rate limits, never relays
                               │ writes the message to a short-lived spool (disk) → replies 250 at once
                               ▼  dispatcher: POST spooled message (private Docker network, INBOUND_SECRET),
                                  bounded concurrency, retry with backoff, then delete from spool
            app-prod /api/inbound/email      or      app-preprod /api/inbound/email
                               │ mailauth DKIM/ARC → sender allow-list → parser → leads → log
```

### Load & retries (owner requirement: retrying senders must never affect the system)
- **Short SMTP sessions:** the receiver only validates the recipient, enforces size, spools to disk and
  answers. Parsing happens later, off the connection, so slow work never holds connections open.
- **Hard caps:** max simultaneous connections (e.g. 50), per-IP connection rate, per-token messages per
  hour, max message size (SMTP `SIZE` refuses big mail before it's sent), idle and total timeouts.
- **Cheap rejection first:** unknown recipients get `550` at `RCPT` — no body is ever received for them.
- **Back-pressure:** if the spool or the app is saturated the receiver answers `451 try again later`;
  sending servers (Gmail) back off and retry on their own schedule (minutes → hours, up to ~5 days), so a
  burst is spread out rather than piled on. Permanent `5xx` only for genuinely bad mail.
- **Bounded processing:** the dispatcher feeds the app with low fixed concurrency (e.g. 2), so the web app's
  memory/CPU stay predictable no matter how much mail queues. Spool files older than 24 h are dropped and
  logged (bodies never kept beyond processing).
- **Abuse:** fail2ban jail for repeated SMTP protocol errors; connection logs metadata only.

- **mail-in** runs from the app image (`node scripts/mail-in.mjs`) — no second build; ~128 MB cap; host
  port 25 → container 2525, non-root. Routes by recipient domain to the matching app.
- TLS: Certbot certificate for `in.jobtiva.in` + `in.preprod.jobtiva.in`, mounted read-only.
- DNS (HostingRaja): `A in → 13.205.239.50`, `MX in → in.jobtiva.in`; same for `in.preprod`.
- AWS security group + ufw: open **25/tcp** inbound. (Inbound 25 is allowed on EC2; we never send on 25.)
- Gmail OAuth code, its cron line and `GOOGLE_CLIENT_*` env **stay**; every entry point checks
  `gmail_oauth_enabled` (cron sync, Sync now, link hook, settings data, dashboard widgets).
- Runbooks: `deploy/VPS.md`, `deploy/DOMAIN.md`.

## 7. Security (Phase 5 — each item tested and reported)

1. No open relay; only our domains + known tokens accepted (reject at RCPT, before DATA).
2. DKIM (or ARC from Gmail) must pass for an allowed signing domain; From must match an allowed sender.
3. Limits: max size, idle/total timeouts, max concurrent connections, messages per token per hour.
4. Internal endpoint: bearer secret, reachable only from the Docker network, Zod-validated, size-capped.
5. Privacy: bodies never stored (spool holds a message only until processed, max 24 h); rejected mail logs
   neither subject nor full sender — sender **domain** only; log purged after 30 days.
5b. Load: a flood test (many concurrent connections + retries) leaves the web apps responsive; caps and
   `451` back-pressure behave as specified.
6. Admin actions `requireAdmin` + Zod; address reset invalidates immediately.
6b. Connect Gmail switch: with it off, the Google link callback, Sync now and the cron all refuse server-side;
   after switch-off no `account` row with provider `google` remains and each token was revoked at Google.
7. Test cases: forged LinkedIn email, ARC-only pass, oversized, unknown token, relay attempt, duplicate
   Message-ID, malformed MIME, disabled forwarding, unsupported sender.
8. `npm audit` + security headers re-checked with the new dependencies.

## 8. Content (Phase 6)

Home FAQ (leads intake via forwarding; "Does Jobtiva read my email?"; the Gmail FAQ shown only while
Connect Gmail is active), Privacy (a forwarding section; the Gmail / Google Limited Use section rendered only
while Connect Gmail is active), Terms (forward only mail you're entitled to; unsupported mail may be
rejected; plus the pending general review), How-to guide "Set up email forwarding", in-app texts. The Google
Cloud project stays (Connect Gmail still uses it).

## 9. Phases & checkpoints

| Phase | Output | Checkpoint (owner) |
|---|---|---|
| 1 Finalize | this spec | approve spec ✅ |
| 2 UI (sample data) | admin A1–A6 and user U1–U8 screens, fully navigable on mock data (CLAUDE.md: UI first) | click through admin + user screens |
| 3 DB | migrations for §5 — shaped by what Phase 2's UI needs | approve schema |
| 4 Structure + wiring | mail-in container + spool, DNS, TLS, port 25, routing; endpoint, parser routing, switch enforcement; mocks replaced by real data | demo on preprod with own Gmail |
| 5 Security | tests in §7 with results (incl. load) + the login rate-limit fix | review report |
| 6 Content | Home, Privacy, Terms (incl. general review), guide, in-app texts | review wording |

Samples for parser/DKIM tests: 4 real LinkedIn alerts (`.eml`, owner's Desktop `linkedin-samples`, all
`d=linkedin.com` + Gmail ARC seal). Used locally only — never committed (personal data).

Order of release: forwarding + the Connect Gmail switch ship on preprod first, then prod, with the switch
**on** (today's behaviour). The owner decides when to turn Connect Gmail off — so nobody loses intake
during the switch.
