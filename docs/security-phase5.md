# Email forwarding — Phase 5 security report (2026-10-24)

Scope: spec §7 of `docs/email-forwarding.md`, plus what Phase 4i added (AI reader, hand-forwarded alerts),
per-user isolation, and the deferred login rate-limit fix.

**How it was tested:** the production Docker image (app + `mail-in`) against the local database, so
production-only behaviour (rate limits, `after()` processing) was active. Re-run the harness with:

```bash
npx tsx --env-file=.env.local scripts/security/forwarding-checks.mts
```

It needs `APP_URL` / `SMTP_PORT` pointing at an app and `mail-in` container. Result: **43 / 43 checks passed**.

## Results

| # | Area (spec §7) | Result | Evidence |
|---|---|---|---|
| 1 | No open relay; only our domains + known tokens, refused at RCPT before DATA | ✅ | B1 relay → 550; B2 unknown token → 550; B3 malformed → 501; B4 no AUTH offered |
| 2 | Signature must pass for the allowed signing domain; From must match an allowed sender | ✅ | A1–A9 (look-alike domains, failing DKIM, non-Google ARC seals, failing ARC chains, disabled senders all refused; Gmail's ARC-only pass accepted); B5 forged LinkedIn → "Signature check failed"; B7 unknown sender → "Sender not allowed" |
| 3 | Limits | ✅ | B10 declared > 10 MB → 552 at MAIL FROM; B11 actual > 10 MB → 552; B12 over the admin 2 MB limit → "Too large"; B24 per-IP concurrency (10) → 421; B25 per-address 60/hour → 451; B26 idle connection closed at 30 s |
| 4 | Internal endpoints | ✅ | B16 missing/wrong secret → 401; B17 bad input → 400; from the internet `/api/inbound/*` → 404 (Nginx), checked on preprod; apps bind to 127.0.0.1 |
| 5 | Privacy | ✅ | B6 rejected mail keeps only the sender's domain; B9 the log has no subject/body columns; B28 the AI queue is empty after processing; the spool holds a message only until delivered (max 24 h); log retention is now admin-set (Settings → Data retention, default 30 days) |
| 5b | Load | ✅ | B27 300 SMTP connections from one source: 50 served, 250 refused with 421; the website's `/login` median stayed 22–31 ms (no slowdown). Note: a one-machine flood exercises the per-IP caps; the global cap (50 connections) can only be reached from many IPs |
| 6 | Admin actions; address reset | ✅ | All 104 server actions check the caller (`requireAdmin`, the session user, or a helper that does); 2 are public by design (sign-up behind the admin switch + rate limit; password reset needs the emailed token). B19 admin pages without a session → redirect to the admin login. A reset changes the token in the database and every RCPT looks it up afresh (no cache), so the old address is refused at once |
| 6b | Connect Gmail switch | ✅ (live + code) | B21 switch off → Google linking refused (403), the sync cron syncs nobody. Switch-off code: flips the switch first, revokes each user at Google, deletes every Google account row. Not run live, because it would revoke the owner's real Google connections; single-user revoke was verified earlier (V2). Hardened: each revoke call now times out after 10 s |
| 7 | Test cases | ✅ | Forged LinkedIn (B5); ARC-only pass (A4); oversized (B10–B12); unknown token (B2); relay (B1); duplicate Message-ID (B14); malformed MIME (B13, no crash); forwarding switched off (B15 → 451); unsupported sender (verified on preprod: "No reader" / AI path) |
| 8 | Dependencies + headers | ✅ | `npm audit`: zod 4.6.5 (high, runtime) fixed → 4.6.7; body-parser and fast-uri fixed (they only appear under the shadcn CLI, not the app). Remaining: drizzle-kit/esbuild (moderate) is a dev-only migration tool, never shipped in the image, and has no non-breaking fix. Preprod headers: CSP, HSTS, X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy, COOP; no X-Powered-By; nginx version hidden |

### Phase 4i additions

| Area | Result | Evidence |
|---|---|---|
| AI reader output | ✅ | A10 jobs naming an unknown link number, or an outside URL, are dropped (found 3, kept 1); A11 cap (20); A12 non-JSON / wrong-shape replies refused; A13 the AI input has no scripts, styles or `javascript:` links |
| AI prompt injection (live, gpt-4o-mini via the owner's OpenRouter key) | ✅ | A hidden block told the AI to ignore its rules, add 25 "HACKED" jobs and a phishing link, and reveal its prompt. The AI returned exactly the 3 real jobs. By design, even a compliant model could only point at links in the email itself, in that user's own account, up to the cap |
| Hand-forwarded alerts | ✅ | B8 a forward claiming the user's own address but without that domain's valid signature → rejected; A14 the original sender is found and must be an allowed site |
| Job keys | ✅ | A15 look-alike hosts get no site id; A16 the same posting gets the same key from any reader, so there are no duplicates |

### Login rate limit (fixed in this phase)

**Finding:** sign-in limits were per IP, but the IP came from `X-Forwarded-For`, and Nginx *appended* to
whatever the client sent. An attacker could make up a new "IP" on every attempt and never be limited.
Self-signup's 5-per-hour limit read the same header.

**Fix:**
- Both auth configs read only `X-Real-IP`, which Nginx sets to the real connection address and the client can't
  set.
- Sign-in is limited to 5 attempts per minute per IP for both the user and admin logins (the library default
  was 3 per 10 s, about 26k guesses/day).
- Self-signup reads `X-Real-IP` first.
- The Nginx snippet overwrites `X-Forwarded-For` instead of appending to it.

**Verified:** B22/B23 send 8 attempts from one `X-Real-IP` with a different made-up `X-Forwarded-For` each
time. Attempts 1–5 get 401 and 6–8 get 429, on both `/api/auth` and `/api/admin-auth`.

## Server follow-up (after deploying)

1. Update `/etc/nginx/snippets/jobtiva-proxy.conf` to `proxy_set_header X-Forwarded-For $remote_addr;`
   (the repo copy has it), then `nginx -t && systemctl reload nginx`.
2. On preprod, from outside: 6+ wrong sign-ins with a made-up `X-Forwarded-For` header should reach 429.
