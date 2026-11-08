# Payments — Phase 4 security report (2026-11-08)

Scope: online plan payments (Razorpay checkout, webhook, admin gateway settings, orders),
limited mode after a plan ends, the renewal reminder job, and the headers added for checkout.

**How it was tested:** the production Docker image on `127.0.0.1:3100` against the local
database, so production-only behavior (CSP and other headers, auth cookies, Server Action
routing) was what ran. The harness signs in over HTTP as the local test user and admin and
calls Server Actions the same way a browser does, using the action ids from the build's
manifest. Re-run it with:

```bash
docker run -d --name jobtiva-sec -p 127.0.0.1:3100:3000 --env-file <env for the container> jobtiva:localtest
docker cp jobtiva-sec:/app/.next/server/server-reference-manifest.json <manifest.json>
APP_URL=http://127.0.0.1:3100 ACTION_MANIFEST=<manifest.json> \
  node --env-file=.env.local --require ./scripts/security/server-only-stub.cjs \
  --import tsx scripts/security/payments-checks.mts
```

The container's env is `.env.local` without quotes, with `DATABASE_URL` pointing at
`host.docker.internal` and `BETTER_AUTH_URL=http://127.0.0.1:3100`. The harness swaps in
throwaway gateway keys it knows the secrets of (Razorpay rejects them), and restores the real
gateway row, Billing and the test user's plan afterwards. Result: **60 / 60 checks passed.**

## Results

| # | Area | Result | Evidence |
|---|---|---|---|
| A | Every Server Action checks its caller | ✅ | A1 static scan of all 153 actions: each calls `requireAdmin`, a session helper, or a local helper that does. Public by design: sign-up, password reset (emailed token), one-click unsubscribe (HMAC token, constant-time compare) |
| P | Plans and prices can't be tampered with | ✅ | P1–P4 free, inactive, unlisted and unknown plans refused before any order exists; P8 the request sent `amount: 100` and the order was created at the full price (the server ignores it); P9 malformed input refused; P10 signed out → turned away |
| P | Online payment only when allowed | ✅ | P5 Billing incomplete and P6 gateway off → no order, the support-request fallback; P7 deactivated account can't pay |
| O | Other people's orders (IDOR) | ✅ | O1 verifying another user's order with a correct signature → "Order not found"; O2 can't cancel it; O3–O7 a user session calling admin actions (orders list, renewals, gateway settings, resend receipt, save keys) is sent to the admin login and nothing changes |
| S | Checkout signature | ✅ | S1 wrong signature, S2 a signature for a different payment id, S3 malformed, S4 a gateway order id that isn't this order's → all refused. S5 a **correct** signature that Razorpay can't confirm still leaves the order unpaid: the server always fetches the payment and checks the amount |
| W | Webhook | ✅ | W1–W4 missing, wrong, non-hex, and body-changed-after-signing → 401 before anything is read from the database; W5 oversized → 413; W6 a signed event for an order that isn't ours → ignored; W7–W9 wrong amount, wrong currency, not captured → not paid; W10 five identical webhooks at once → plan extended exactly one month (row lock); W11 replay → no change; W12 a later `payment.failed` and W13 the browser's "failed" call can't undo a paid order |
| B | Tax at time of payment | ✅ | B1 changing Billing (rate, business name) afterwards leaves the order's amounts and Billing snapshot untouched |
| R | Abuse limit | ✅ | R1 the 11th checkout in an hour is refused (10 per user per hour) |
| K | Secrets | ✅ | K1 key and webhook secrets stored encrypted (no plaintext in the row); K2 the admin Settings page contains neither the secrets nor their ciphertext, only the key ID; K3 the gateway action returns only "is set" flags; K4 failure reasons never include a secret |
| G | Admin gateway rules | ✅ | G1 test key in live mode refused; G2 a new key ID needs its secret; G3 keys can't be removed while on; G4 can't turn on without all three credentials |
| L | Limited mode | ✅ | L1 all 9 feature pages redirect an expired user to /upgrade; L2 Upgrade Plan, Settings and guides stay open; L3 a forged `x-pathname` header doesn't unlock a page (middleware overwrites it); L4 client-side (RSC) navigation is redirected too; L5 adding a lead and L6 a Settings feature action are refused on the server (no row written); L7 the expired user can still pay |
| C | Cron and admin pages | ✅ | C1–C3 reminders cron: no / wrong bearer → 401, right one → 200; C4 Orders, Renewals and Settings need an admin session (signed out → admin login, user session → redirect) |
| H | Headers (production) | ✅ | H1 `script-src` adds only `https://checkout.razorpay.com`, no wildcards; H2 frames limited to known hosts; H3 `frame-ancestors 'none'` + `X-Frame-Options: DENY` kept; H4 `same-origin-allow-popups` only on /upgrade and /settings, `same-origin` elsewhere; H5 the Payment Request API is allowed only for us and Razorpay |

## Fixed in this phase

**Limited mode could be bypassed through Settings actions.** Phase 3 gated the feature actions
in leads, AI, notes, career, ATS, salary and Gmail sync, but `actions/settings.ts` and
`actions/email-intake.ts` still accepted calls from an expired user, so a script could keep using
résumés, AI settings, follow-ups, Gmail config and email forwarding. Those 15 actions now use
`getActiveUserId()`. Still allowed while expired, on purpose: editing the profile, promo email
opt-out, removing the AI key, disconnecting Google, and downloading your own résumé (privacy and
account control). L6 covers it.

## Dependencies (`npm audit --omit=dev`)

- **better-auth 1.7.5 → 1.7.18 (upgraded).** 1.7.5 had one critical, one high and one low
  advisory, all fixed in 1.7.7. None applied here: the critical one needs the Magic Link plugin, the
  high one the OAuth Proxy plugin, and the low one database-backed rate limits (this app uses only
  `nextCookies()` and keeps rate limits in memory). Upgraded anyway. No schema change: every field
  1.7.18 expects is already in `db/auth-schema.ts`. The full check run was repeated on the new
  version (sign-in for user and admin is part of it).
- **mailauth → joi (high):** a slow-regex denial of service in `string().email({ multiple: true })`.
  It belongs to email forwarding (DKIM checks in `mail-in`), not payments. Follow-up: check
  whether mailauth reaches that path with sender-controlled input, or pin a fixed version.
- **systeminformation (high), deepmerge, ts-morph, minimatch:** only under the `shadcn` CLI,
  which is listed in `dependencies` but never imported, so it isn't in the standalone image.
  Moving `shadcn` to devDependencies would clear these from the report.
- **drizzle-kit / esbuild (moderate):** the migration tool, not shipped.

## Notes and known limits

- **Switching a gateway between test and live with orders still pending:** verification uses the
  keys saved now, so a payment started in test mode can't be confirmed after switching to live
  (and the other way round). Nothing is wrongly marked paid; the order stays Pending. Switch modes
  when no checkout is open.
- **The webhook reads the whole body before the 256 KB check.** Nginx's `client_max_body_size`
  (8 MB) bounds it in production.
- **Lead intake pauses in limited mode** (owner decision, 2026-11-08). Forwarded alerts are
  accepted but logged as Paused and not read (checked before the message is marked processed, so
  a hand re-forward after renewing still works); queued AI reads are dropped; Gmail sync skips
  the user and resumes from its cursor, capped at the lookback window. See `lib/intake-pause.ts`.
- **Not covered here:** a live Razorpay webhook from Razorpay's servers (preprod only, since
  Razorpay can't reach localhost). The real checkout window was tested by the owner on 2026-11-08
  in test mode: the payment went through, the order was Paid, and the plan renewed.
