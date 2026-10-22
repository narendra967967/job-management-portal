# Email forwarding — spec (Phase 1)

Status: **approved scope, 2026-10-22.** Replaces "Connect Gmail" (Google OAuth, `gmail.readonly`).
Jobtiva receives job-alert emails that users **forward** to a private address, so it needs **no Google
permission at all**: no OAuth verification, no paid CASA assessment, no 100-user cap, no "unverified app"
screen. Pattern used by e.g. TripIt (`plans@tripit.com`).

## 1. Decisions

| # | Decision |
|---|---|
| D1 | **Remove "Connect Gmail"** entirely once forwarding ships (OAuth, Gmail sync, sync schedule). |
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

Removed for users: "Gmail connection", "Sync schedule" (sync interval, pause) — mail now arrives in real
time. Lead **retention/purge** stays.

## 5. Data model (Phase 2 — needs owner OK: touches several tables)

New:
- **`inbound_addresses`** — `user_id` (PK, FK cascade), `token` (unique, 10+ chars, random), `created_at`,
  `gmail_code`, `gmail_code_at`, `confirmed_at`, `first_received_at`, `last_received_at`.
- **`inbound_email_log`** — `id`, `received_at`, `user_id` (nullable — unknown recipient), `env`,
  `from_address`, `signing_domain`, `status` (`accepted | rejected | unsupported | duplicate | gmail_code`),
  `reason`, `size_bytes`, `message_id`, `leads_created`. Index on `received_at` for the 30-day purge.
- **`inbound_config`** (single row, like `cron_config`) — `enabled`, `max_bytes`.
- **`inbound_senders`** — `id`, `match` (`jobalerts-noreply@linkedin.com` or `*@domain`), `signing_domain`,
  `parser` (`linkedin` | `none`), `enabled`, timestamps. Seeded with LinkedIn.

Reused as-is: `gmail_processed_messages` (dedupe by RFC `Message-ID`), `gmail_ingest_errors` (parse
issues), `job_leads` (`origin = 'system'`, `source` from URL).

Removed (after release, D1): Google `account` rows (tokens **revoked first** by a one-off script),
`gmail_config`, `gmail_sync_state`, `user_settings.sync_interval_hours`, the quiet-hours columns of
`cron_config` (purge columns stay).

## 6. Architecture (Phase 3)

```
Gmail ──SMTP:25 (STARTTLS)──► mail-in container (smtp-server)
                               │ accepts RCPT only for <token>@in.jobtiva.in / in.preprod.jobtiva.in
                               │ size cap, timeouts, connection & per-token rate limits, never relays
                               ▼  POST raw message + recipient (private Docker network, bearer INBOUND_SECRET)
            app-prod /api/inbound/email      or      app-preprod /api/inbound/email
                               │ mailauth DKIM/ARC → sender allow-list → parser → leads → log
```

- **mail-in** runs from the app image (`node scripts/mail-in.mjs`) — no second build; ~128 MB cap; host
  port 25 → container 2525, non-root. Routes by recipient domain to the matching app.
- TLS: Certbot certificate for `in.jobtiva.in` + `in.preprod.jobtiva.in`, mounted read-only.
- DNS (HostingRaja): `A in → 13.205.239.50`, `MX in → in.jobtiva.in`; same for `in.preprod`.
- AWS security group + ufw: open **25/tcp** inbound. (Inbound 25 is allowed on EC2; we never send on 25.)
- Remove: Gmail-sync cron lines + `/api/cron/gmail-sync`, `lib/gmail.ts`, `lib/gmail-sync.ts`, Google
  social provider + `GOOGLE_CLIENT_*` env. Purge cron stays.
- Runbooks: `deploy/VPS.md`, `deploy/DOMAIN.md`.

## 7. Security (Phase 5 — each item tested and reported)

1. No open relay; only our domains + known tokens accepted (reject at RCPT, before DATA).
2. DKIM (or ARC from Gmail) must pass for an allowed signing domain; From must match an allowed sender.
3. Limits: max size, idle/total timeouts, max concurrent connections, messages per token per hour.
4. Internal endpoint: bearer secret, reachable only from the Docker network, Zod-validated, size-capped.
5. Privacy: bodies never stored; rejected mail logs no subject; log purged after 30 days.
6. Admin actions `requireAdmin` + Zod; address reset invalidates immediately.
7. Test cases: forged LinkedIn email, ARC-only pass, oversized, unknown token, relay attempt, duplicate
   Message-ID, malformed MIME, disabled forwarding, unsupported sender.
8. `npm audit` + security headers re-checked with the new dependencies.

## 8. Content (Phase 6)

Home FAQ (leads intake, "Does Jobtiva read my email?"), Privacy (forwarding replaces Gmail access; remove
Google Limited Use section), Terms (forward only mail you're entitled to; unsupported mail may be
rejected; plus the pending general review), How-to guide "Set up email forwarding", in-app texts, and
retiring the Google Cloud project / `docs/google-verification.md`.

## 9. Phases & checkpoints

| Phase | Output | Checkpoint (owner) |
|---|---|---|
| 1 Finalize | this spec | approve spec |
| 2 DB | migrations for §5 (new tables first; removals after the switch) | approve schema |
| 3 Structure | mail-in container, DNS, TLS, port 25, routing | a test email reaches preprod |
| 4 Code + UI | admin A1–A5, user U1–U7, endpoint, parser routing, Gmail removal | demo on preprod with own Gmail |
| 5 Security | tests in §7 with results | review report |
| 6 Content | pages + guide + Google retirement | review wording |

Order of release: forwarding ships **alongside** Connect Gmail on preprod first; once verified, prod; then
the removal migration (tokens revoked) — so nobody loses intake during the switch.
