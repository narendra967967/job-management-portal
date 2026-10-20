# Google OAuth verification — `gmail.readonly` (data access)

Status (2026-10-20): domain verified (Search Console), **branding verified**, app **published "In
production" unverified** (100-user lifetime cap, "unverified app" warning). This file holds everything
needed for the **data-access review** and the **CASA security assessment**. Everything below is accurate
to the code as of `d1ece83`; re-check it if the Gmail sync, the AI features or the privacy policy change.

> **Submit only when you're ready to complete CASA.** Google requires a CASA Letter of Validation for
> restricted scopes whose data is stored on a server (ours is). If the review is rejected, Google says
> users' access to the restricted scope stops working — today Gmail works for ≤100 users unverified, so a
> failed submission would break that. Prepare first; submit together with a booked CASA lab.

---

## 1. What we tell Google

### Permitted use (Workspace API user data policy)
Pick: **"Applications that use information from emails to provide reporting or monitoring services for
the benefit of users"** (Google's examples: itinerary, package and flight tracking). Jobtiva tracks job
opportunities from the user's own job-alert emails the same way.

### Scope
Only `https://www.googleapis.com/auth/gmail.readonly` (plus `openid`, `email`, `profile`). No send,
modify, compose, labels or full-mailbox scopes.

### Justification (paste; ~950 characters)

> Jobtiva is a personal job-search tracker. Connecting Gmail is optional: it lets Jobtiva find the
> job-alert emails the user already receives (by default from LinkedIn job-alert senders, adjustable in
> Settings) and turn each listed job into a tracked lead (title, company, location, link). The sync calls
> users.messages.list with a query limited to the user's job-alert senders or label, then
> users.messages.get only for those results, and parses the HTML body. We need gmail.readonly because the
> job details exist only in the message body: gmail.metadata returns headers only and cannot read bodies,
> and no narrower read scope exists. We never send, modify, label or delete mail. We store only the
> extracted job fields and the message ID (to avoid duplicates), never full email content. Tokens are
> encrypted at rest; disconnecting revokes access at Google.

### Data-handling facts (for the questionnaire / CASA)
| Question | Answer |
|---|---|
| Where is data processed/stored? | Our server: AWS EC2, Mumbai (ap-south-1); PostgreSQL on the same host. |
| What Gmail data is stored? | Per matching message: job title, company, location, posting URL (as a lead) + Gmail message ID. For unparseable messages, the subject (≤500 chars) in `gmail_ingest_errors`. No bodies. |
| Is Gmail data shared? | Only when the user requests an AI feature (fit score, outreach draft, salary insight): the lead's title/company go to the configured AI provider (OpenAI, Anthropic or OpenRouter, optionally with the user's own key). Never sold, never ads, never used to train models. |
| Human access? | None, except with user consent (support), for security, or legal requirement. |
| Encryption | HTTPS everywhere; Google tokens encrypted at rest (Better Auth `encryptOAuthTokens`); AI keys AES-256-GCM; encrypted off-site backups (30 days). |
| Deletion | User deletes leads any time; account deletion on request within 30 days (backups expire within a further 30). Disconnect revokes the token at Google and deletes it. |
| Read path | `lib/gmail.ts` (list/get only), `lib/gmail-sync.ts`, deterministic parser `lib/linkedin-parser.ts` (no AI). Query built by `buildGmailQuery` — never unfiltered. |

---

## 2. Demo video (YouTube, **Unlisted**, English, ~3 minutes)

Record the screen at 1080p (Windows: Xbox Game Bar `Win+Alt+R`, or OBS). Narrate or add captions.
Use a real Jobtiva account and a Gmail inbox that has at least one LinkedIn job-alert email.

1. **Intro (5 s):** "Jobtiva — demo of Gmail read-only access for OAuth verification."
2. **Homepage:** open `https://jobtiva.in`, scroll to the FAQ "Why does Jobtiva ask for access to my
   Gmail?", then open the **Privacy policy** and show the Gmail / Limited Use section.
3. **Sign in** to Jobtiva (email + password) → **Settings → Gmail**. Show the sender filter
   (`jobalerts-noreply@linkedin.com` …) and say: "Only emails from these senders are read."
4. **Connect Google:** click **Connect Google** → choose the Google account →
   - on the **consent screen**, pause and show the app name **Jobtiva**, the logo, and the permission
     "Read your email messages and settings";
   - **click into the address bar and scroll** until `client_id=…apps.googleusercontent.com` is visible
     (Google requires the client ID to be visible in the video);
   - click **Allow** → back on Jobtiva showing **Connected**.
5. **Show the source email:** in another tab, open Gmail and show a LinkedIn job-alert email.
6. **Use of the scope:** back in Jobtiva → **Sync now** → open **Leads** → show the job(s) from that
   email (source "LinkedIn Jobs · System"), open one lead and show the stored fields and the link.
   Say: "Jobtiva only extracts the job details; it never changes, labels or deletes email." Show the
   email in Gmail is untouched.
7. **AI feature (data transfer disclosure):** on that lead, run **Fit score** and say: "Only the job's
   title and company, the saved job description and the user's résumé are sent to the AI provider, only
   when the user asks."
8. **Disconnect:** Settings → **Disconnect Google** → open `https://myaccount.google.com/permissions` and
   show Jobtiva is gone.
9. **(Recommended) Console:** show Google Cloud → Google Auth Platform → **Clients** with the same client
   ID as in step 4 (one client serves all environments).

Upload to YouTube Studio → Visibility **Unlisted** → paste the link in the verification form.

**Uploaded (2026-10-20):** https://youtu.be/1iM7YGYXzVM — "Jobtiva – Gmail read-only access (OAuth
verification demo)", 6:02, channel @Jobtiva. Plays logged out. Covers scenes 1–9 except showing the source
job-alert email in Gmail (add it if a reviewer asks).

---

## 3. CASA (security assessment) — prepare before submitting

- Tier is assigned by Google (usually **Tier 2** for restricted scopes); renewed **every 12 months**.
- Choose an authorized lab from the App Defense Alliance list and get quotes (published prices range from
  about $540 to $6,000 for Tier 2). Book it before submitting the form.
- Tier 2 = scans you run (e.g. the lab's DAST/SAST tooling) + lab validation. Do a dry run first:
  - dependencies: `npm audit` clean of high/critical (16 remaining were dev/CLI-only at last check);
  - headers: ✅ set in `next.config.ts` (`e67fc1a`) — CSP (prod builds), HSTS, nosniff,
    Referrer-Policy, X-Frame-Options/frame-ancestors, COOP, Permissions-Policy; `X-Powered-By` off.
    Open item: CSP `script-src` still allows `'unsafe-inline'` (Next.js bootstrap) — move to a nonce-based
    CSP if the lab flags it. Nginx `server_tokens off` hides its version (server step);
  - auth: rate limiting on login/reset (sign-up has it), session/cookie flags, password policy (admin);
  - secrets only in env/DB-encrypted; TLS A grade (`ssllabs.com`);
  - documented data deletion process (see the privacy policy).

## 4. Submit checklist
- [ ] CASA lab booked
- [ ] Video uploaded (Unlisted), link works when logged out
- [ ] Privacy policy, homepage FAQ and this file still match the code
- [ ] Google Auth Platform → **Verification Center → Prepare for verification** → permitted use (above),
      justification (above), video link, docs links (privacy policy, homepage), submit
- [ ] Watch the email inbox of the project owner/contacts; reply to Google within their deadline
