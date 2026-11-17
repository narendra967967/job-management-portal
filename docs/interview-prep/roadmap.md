# Interview Preparation: roadmap

Status: **approved by the owner, November 17, 2026.** Nothing is built yet; work starts when the owner says go.
The decisions behind it are in `docs/interview-prep/spec.md` (D1 to D58) and `docs/gst/spec.md` (G1 to G11).

## 1. The big picture

Two tracks run side by side. The build track is the code, phase by phase, with an owner checkpoint after each.
The outside track is the owner's: approvals and advice from other people, which run on their clocks. Starting
those early keeps the build from stalling.

| Order | Build track | Outside track (owner, in parallel) |
|---|---|---|
| Now | Nothing until the owner says go | Apply for RazorpayX. Book the CA. Follow up AWS SES production access |
| Release 1 | AI mock interviews (text) | Enter the module AI key in admin. Set the per-minute price from measured cost |
| GST | GST panel, billing details, invoices, credit notes | CA answers the GST questions (needed before GST is switched on, not before it's built) |
| Release 2 | Human mock interviews marketplace | Lawyer reviews the agreement and policies. Workspace trial at R2.0. RazorpayX approved |
| Later | Voice, recommendations, packages | As needed |

**Why this order.** Release 1 needs no money rules beyond the existing checkout, no legal pages and no outside
approval. It also builds the shared report format that human interviews must use. GST comes next because
Release 2 sells to the public and its invoices and refunds depend on it. Release 2 comes last because it waits
on RazorpayX, the CA, the lawyer and the Meet test.

**Sizes, not dates** (the owner chose quality over speed). S is about one Amazon SES phase, M about one Email
templates phase, L a whole module like Broadcasts, XL bigger than anything built so far.

## 2. Rules every phase follows

A phase isn't done until all of these hold (from `CLAUDE.md` and the standing rules):

- Branch checked first (`narendra` only). Small commits, never pushed; the owner merges and deploys.
- Screens first on clearly marked sample data, then the database, then wiring. Sample data is removed in the
  database phase.
- Mobile-first: every screen checked at 375 px and 768 px, no sideways scrolling, touch targets at least 44 px.
- Every data list is a table (selection, Action column, pagination, filters, stat boxes).
- Every input has a hint where needed and validation; every Server Action checks the session and validates with
  Zod; every query is scoped to the user.
- Every new automatic email is registered in Engagement → Email templates. New log tables go into Data retention.
- Reader-facing text follows the human-writing rules. Admin screens have no explanatory subtitles; side notes go
  behind an info icon.
- Knowledge-base articles change in the same commit as the behavior. Type check, lint and check scripts pass. No
  secrets in the diff.
- Tests that change settings put back the exact original values. Any dev server started is stopped at the end.
- Ask before any new dependency or a schema change across several tables.

## 3. Settled before Release 1 (November 17, 2026)

- A paid plan's AI allowance is granted **each plan period, with no carry-over**.
- Any AI interview outside the allowance is **priced per minute**: admin sets the rate, and the price is the rate
  times the chosen duration.
- Each part of the module has an **Open / Coming soon** switch for candidates (AI interviews, human interviews),
  plus the separate switch for interviewer applications.
- The module's AI provider and model are chosen at R1.6, after comparing two models on quality and cost.

## 4. Release 1: AI mock interviews (text)

### R1.1 Navigation: two main menus (S to M)

Split the signed-in app into **Lead management** (every current menu) and **Mock interviews**, before any module
screen exists, so the change can be checked on its own.

- Sidebar with the two main menus and their sub-menus; the phone menu to match.
- Mock interviews section with placeholder pages, behind the **Open / Coming soon** switches.
- Plan lock: without an active plan, Lead management locks as today; Mock interviews stays open (D4).
- Onboarding tour updated for the new layout, with the tour version bumped so existing users see it once.

**Owner checks:** every existing page opens from the new menus on phone and desktop; an expired-plan account has
lead pages locked and Mock interviews open; nothing else in the job tracker changes.

### R1.2 Candidate screens on sample data (M)

- New interview: role, industry, category, difficulty, duration; resume, job description (or General
  preparation) and topics, typed or picked from the career profile or a lead.
- Allowance check: interviews left on the plan, or the per-minute price for the chosen duration and a Pay button.
- The interview: chat screen, timer, wrap-up notice, the 10-minute extension, the end.
- Interrupted interview: the Resume banner within 15 minutes.
- The shared report page: five scores, the overall score out of 100, the five written parts, the source label.
- Interview history (a table) and Performance (a trend chart per metric, filter by AI or human).
- "Prepare for this interview" on leads with status Interview.
- Coming-soon page for when AI interviews are switched to Coming soon.

**Owner checks:** the whole journey at 375 and 768 px. The report page matters most: human interviewers fill in
the same format later.

### R1.3 Admin screens on sample data (M)

- Mock interviews admin menu with its own settings page (D9): the Open / Coming soon switches; AI provider,
  model and key (write-only); categories; difficulty levels; durations; minutes per question; pace grace period (5 min); wrap-up time;
  resume window; **price per minute**; prompts (including the question-plan prompt); metric weights.
- Plan editor: AI mock interviews included (per plan period).
- AI interview usage: sessions table, cost per session and in total, each session's event log.
- Credit action on a session (for interviews that broke), with a required note.

### R1.4 Database (M)

Needs R1.2 and R1.3 approved. Tables written from the approved screens: module settings; AI sessions, messages
and events; evaluations (shared later with human interviews); plan columns; AI interview purchases and credits.
A settings snapshot on each session (D36). The event log goes into Data retention. Server Actions behind every
screen. Sample data removed.

### R1.5 Wiring: the AI interviewer (L)

Needs the module AI key entered in admin by the owner.

- Module key path in `lib/ai.ts`, separate from users' keys and the knowledge-base key.
- The question plan: at the start, the candidate's inputs go to the AI, which generates questions sized to the
  chosen duration (duration ÷ minutes per question) across the five report metrics.
- The interview loop: the planned questions in turn, follow-ups where scoring needs them, the hard 10-minute
  wrap-up, then the end.
- Evaluation: one structured AI call checked against the report format, retried if the reply doesn't fit.
- Allowance (free interview once ever on Free; plan allowance per period) and per-minute purchase through the
  existing Razorpay checkout as a new purchase type.
- Resume within 15 minutes; the full event log; admin credits.
- Token use and cost recorded per session.
- Emails registered in Email templates: purchase receipt (or the existing receipt extended) and feedback ready.

**Owner checks:** two or three real interviews; then try to break it (close the tab mid-interview, run out of
allowance, pay for one).

### R1.6 Quality tuning and pricing (M)

- Practice runs across categories and difficulty levels on the local test accounts.
- Prompt tuning for question quality, follow-ups and fair scoring.
- Two models compared on quality and cost.
- A short cost report: average and worst-case cost per 15, 30, 45 and 60-minute interview, and per minute.

**Owner checks:** reads a few transcripts and reports, picks the model, sets the per-minute price and plan
allowances. Release 1 doesn't roll out until the owner is happy with interview quality.

### R1.7 Safety checks (S to M)

A `scripts/security/` check script: signed-out access refused; one user can't see another's sessions; the
allowance can't be bypassed or spent twice; purchases are idempotent and charge the per-minute price for the
chosen duration; evaluations always match the report format; the module key never reaches the browser; Coming
soon really blocks the feature, not just the menu. Knowledge-base articles. The deploy runbook lists the check.

### R1.8 Content and rollout (M)

Module landing page linked from the homepage sections, header and footer; the Privacy Policy lines for AI interviews and for voice input (the browser's speech service)
interviews; a final check of the new emails; a user guide if wanted. The owner deploys to preprod, tries it,
then promotes to prod.

## 5. GST and invoices (between the releases)

Built from `docs/gst/spec.md`, for all of Jobtiva. It ships with **GST switched off**, so it doesn't wait for the
CA; the CA's answers are needed only before switching it on.

| Step | Size | Work |
|---|---|---|
| G.1 Screens | M | Settings → GST tabs (Registration, States, Products and rates, Invoices, Reports, Thresholds); Billing keeps only the business identity; billing details form before the first payment and in user Settings; invoice and credit note layouts |
| G.2 Database | M | GST settings, states, product tax rows, invoice and credit note series, order columns for the split, billing details on profiles |
| G.3 Wiring | L | Tax from inside the price, split by state, for plans and AI interviews; switch with an effective date; invoice numbers per financial year; credit notes; email and download as PDF (**the PDF library is asked for here**); reports; turnover tracker |
| G.4 Safety | S | Split adds up to the tax; tax plus taxable value equals the price; no gaps in numbering; past sales never change; reports total to the orders |
| G.5 Rollout | S | Knowledge-base articles, Privacy line for billing details, owner deploys with GST off. Also written here: a short **TDS spec** for interviewer payouts from the CA's answer |

## 6. Release 2: human mock interviews

### Gates before it starts

- The CA has confirmed Model B. If the answer is the marketplace model instead, the ledger and payouts change
  shape, so this must come **before R2.4** at the latest.
- RazorpayX approved, or at least applied for (payouts are tested in R2.0).
- AWS SES out of the sandbox (booking emails and reminders go to every user).
- The GST stage live.

### R2.0 Outside tests (S to M)

The Workspace trial starts the day this phase begins (it lasts 14 days).

- Google Meet, four parts: an Open-access meeting two outside people join with nobody from Jobtiva present; a
  calendar event reaching both guests; attendance from conference records; an internal Workspace app with no
  verification and no 7-day token expiry.
- RazorpayX test mode: contact, fund account, payout, status webhook. Bank check by small test deposit.

**Owner checks:** joins the test meetings with two accounts; buys Workspace Base only if the test passes.

### R2.1 Candidate screens on sample data (L)

Find an interviewer (filters, sorting, new-interviewer boost, New tag); public profile at `jobtiva.in/i/<handle>`;
service page with the 50% cancellation rule in plain words; slot picker in the candidate's timezone; booking form
with the resume-sharing and cancellation agreement; the pending booking with its 10-minute countdown and Pay from
My bookings; My bookings and booking details; the Join interview page; reschedule request and response; cancel
with the charge shown; the shared report page, review form, flag evaluation, complaint, report a profile; the
coming-soon page. **Settles:** the furthest reschedule date.

### R2.2 Interviewer screens on sample data (L)

Become an interviewer (onboarding, address, GSTIN or PAN, bank details, Interviewer Agreement); switching between
the normal dashboard and the interviewer area; profile and handle; services; weekly availability, blocked dates
and limits; bookings with the resume (inside its window) and Join page; the evaluation form with autosave,
confirmation word and emailed code; the wallet (Upcoming, Earned, Withdrawable, Paid out, every deduction on its
own line), withdrawal requests and payout history; reviews and replies; report a candidate; raise a no-show
ticket. **Settles:** the remaining onboarding fields.

### R2.3 Admin screens on sample data (L)

Applications; bookings with Join clicks and attendance; release reviews (one screen for every money decision,
with evidence, checklist and a required note); payouts (approve or reject manual withdrawals, automatic payouts
and failures, record a manual payment); refunds; strikes (warnings, blocks, lifting with a reset value); review
moderation; catalog lists; module settings; dashboard numbers.

### R2.4 Database (L)

Needs R2.1 to R2.3 approved and the CA's answer on Model B. Interviewer profiles, services, availability and
blocked dates; bookings and booking events; join clicks and attendance; reviews; strikes; catalog; the
append-only ledger and audit log (balances always calculated from entries); settings snapshot on every booking;
new log tables in Data retention. **Asks:** whether to add the `btree_gist` extension for a stronger
double-booking guard, or stay with row locking.

### R2.5 Wiring (XL)

Needs Workspace bought (if the test passed) and RazorpayX test keys. Built in this order, with a short owner
try-out after each step:

1. Onboarding, approval and the interviewer area; services and availability.
2. Slot holds, pending bookings and expiry (race-safe); payment; the paid-but-no-booking refund.
3. Meet events, updated on reschedule and cancel; calendar file in emails; the Join page.
4. Reminders from the 5-minute cron; every booking email registered in Email templates.
5. Evaluation with the emailed code; the report shared with the candidate; the ping after 40 hours.
6. Ledger and wallet: earned, dispute window, release; penalties, recoveries, reversals.
7. Withdrawals and RazorpayX payouts (manual with approval, automatic at the threshold), webhooks, the manual
   payment fallback.
8. Cancellations, reschedules, no-show tickets, release reviews, strikes and blocks.
9. Reviews, replies, moderation; attendance from conference records.

### R2.6 Safety checks (M)

Every balance equals the sum of its entries; nothing released twice; penalties and refunds stay separate; two
candidates can't hold the same slot; a replayed payment or payout webhook changes nothing; interviewers see only
their bookings and only within the resume window; nobody sees the other side's email or phone; PAN and bank
details encrypted.

### R2.7 Content and legal (M)

Needs the lawyer's review. Interviewer Agreement (drafted here, checked by the lawyer); booking cancellation and
refund policy (updating the Refunds page); Privacy Policy additions (resumes shared with interviewers, billing
details); landing page update; knowledge-base articles; user guides.

### R2.8 Rollout in two steps (M)

1. The owner deploys with **interviewer applications on** and **human interviews set to Coming soon** for
   candidates. The owner approves the first interviewers, who set up profiles, services and availability.
2. When enough interviewers are live (the owner picks the number), the owner switches human interviews to
   **Open**.

Before step 2: one real booking end to end on preprod with live keys and a small real payment, refunded
afterwards.

## 7. Later (not scheduled)

Voice AI interviews; suggesting interviewers from tracked leads; packages and bundles; finance-only admin roles;
Meet attendance reports (needs a higher Workspace plan).

## 8. Risks and fallbacks

| Risk | Fallback |
|---|---|
| AI interview quality is weak | R1.6 is a dedicated tuning step; no rollout until the owner is happy |
| AI cost is higher than expected | Measured in R1.6 before the per-minute price is set; model and pacing are settings |
| The Meet test fails | Decided at R2.0: a Workspace host joins first, or another meeting service |
| The CA rejects Model B | Answer needed before R2.4, so the ledger is designed once (Razorpay Route instead) |
| RazorpayX approval is slow | The "record a manual payment" fallback could carry the launch; owner's call |
| The lawyer is slow | Start the lawyer once R2.2 settles the agreement's contents |
| SES still in the sandbox | A gate before Release 2; SMTP remains as a temporary option |
| The navigation change breaks Lead management | R1.1 is its own small checkpoint before any module work |
| An empty marketplace at launch | The two-step rollout in R2.8, behind the Coming soon switch |

## 9. Owner checkpoints

| # | At | Decides or approves |
|---|---|---|
| 1 | R1.1 | Navigation and the plan lock |
| 2 | R1.2, R1.3 | Every Release 1 screen, especially the report page |
| 3 | R1.5, R1.6 | Real interviews; the model; the per-minute price and plan allowances |
| 4 | R1.8 | Landing page; deploys Release 1 |
| 5 | G.1, G.3 | GST screens; the PDF library; invoices |
| 6 | G.5 | Deploys the GST stage (switched off) |
| 7 | R2.0 | Meet test result; buys Workspace |
| 8 | R2.1 to R2.3 | Every marketplace screen; reschedule limit; onboarding fields |
| 9 | R2.4 | Slot-locking approach |
| 10 | R2.5 | A try-out after each wiring step |
| 11 | R2.7, R2.8 | Legal sign-off; the first interviewers; switching human interviews to Open |
