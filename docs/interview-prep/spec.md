# Interview Preparation module: spec

Status: **scope agreed with the owner, November 13, 2026.** Nothing is built yet. This document is the source of
truth for the module. It replaces the ChatGPT-drafted brief wherever they differ, and the project rules in
`CLAUDE.md` win over both.

The module adds two things to Jobtiva:

1. **AI mock interviews** (Release 1): a candidate practises a text interview with an AI interviewer and gets a
   scored report.
2. **Human mock interviews** (Release 2): a marketplace where candidates find an experienced professional, book a
   slot, pay, meet on Google Meet and get a scored report in the same format.

It sits inside the existing app and account. It doesn't change how the job tracker works.

---

## 1. Decisions

### Product and access

| # | Decision |
|---|---|
| D1 | **AI mock interviews ship first** (Release 1). The marketplace follows (Release 2). Quality over speed. Release 1 succeeds when candidates can practise with the AI interviewer and get useful feedback. |
| D2 | It's a **module of Jobtiva**, not a separate product. The signed-in app gets two main menus: **Lead management** (every current menu) and **Mock interviews** (this module). |
| D3 | The module gets its **own public landing page**, linked from the homepage sections, header and footer. |
| D4 | **Mock interviews is always open**, whatever the user's plan. Without an active plan, Lead management locks (as today) but Mock interviews doesn't. |
| D5 | **AI interview allowance comes from the plan.** The plan editor gets an "AI mock interviews included" count and a "price per extra AI interview". The Free plan includes **1 AI interview, once ever** (the free plan itself is once-only). After the allowance, each AI interview is bought. An expired plan's unused allowance is lost. |
| D6 | **The marketplace is open:** anyone can apply to be an interviewer. Each application is still approved by admin. Candidates choose whom to book. |
| D7 | Interviewers don't need a paid Jobtiva plan. An interviewer can book other interviewers, never their own services. Someone can sign up only to be an interviewer. |

### AI mock interviews

| # | Decision |
|---|---|
| D8 | **Text only** for now. Voice is deferred. |
| D9 | Runs on a **Jobtiva AI key set aside for this module**, separate from users' own keys and from the admin knowledge-base key, so usage is tracked on its own. The module has its **own admin settings page**. Public copy never says whose AI or key runs it. |
| D10 | **Length follows the chosen duration.** Questions per minute is an admin setting (default 2 minutes a question, so 30 minutes ≈ 15 questions with follow-ups). When the time is up, the interview may run up to **10 minutes more** to finish; at that point it ends, whatever is left. Then the evaluation is generated automatically. |
| D11 | Inputs: target role, industry, category, difficulty, resume, job description and topics. Resume, job description and topics are **required**; "General preparation" counts as a job description. Each can be typed or picked from the career profile or a tracked lead. A lead with status Interview gets a **"Prepare for this interview"** button. |
| D12 | Coding and System Design run as **discussion interviews** (explain your approach). No code editor or code execution. |
| D13 | **A broken interview can be resumed within 15 minutes.** Every session records its events (start, each question and answer, disconnects, resume, end) so admin can decide on a credit if it couldn't be finished. |

### Marketplace: interviewers, services, discovery

| # | Decision |
|---|---|
| D14 | Interviewer onboarding collects name, photo, headline, current role, company, years of experience, bio, skills, categories, languages and timezone (required), with education and detailed history optional. The rest of the fields are settled at UI time. At onboarding: **full address** (city, state, PIN code), **GSTIN or PAN** (one required; a GSTIN supplies the PAN) and **bank details**; the bank account is verified before the first payout. See `docs/gst/spec.md` (G7, G10). |
| D15 | "Hide company name" is allowed on the public profile; admin still sees it. |
| D16 | Admin can approve, reject, ask for more information (the form reopens with admin's note at the top), suspend or deactivate. Only approved interviewers can publish and take bookings. |
| D17 | Approved interviewers **publish services freely**; admin can unpublish. Admin sets price limits, allowed durations (15, 30, 45, 60, 90) and how many services each interviewer may have. No free services and no packages for now. |
| D18 | Interviewer profiles are **public and indexable** at `jobtiva.in/i/<handle>`. Booking needs sign-in. |
| D19 | Search order: rating and completed interviews, then soonest availability, plus a **boost for new interviewers for N days** (admin setting). No paid boosting. |
| D20 | Filters: role or designation, category, industry, price, duration, language, rating, available this week. |

### Booking

| # | Decision |
|---|---|
| D21 | Interviewer availability lives **inside Jobtiva**: weekly hours, blocked dates, minimum notice, buffer, maximum bookings a day, booking horizon. Defaults 12 hours, 15 minutes, 4 a day, 30 days; admin sets the defaults and allowed ranges. Google Calendar is never read. |
| D22 | Starting checkout creates a **pending booking that holds the slot for 10 minutes** (admin setting). The candidate sees the countdown and can return to My bookings to pay the same pending booking. The slot is checked again the moment payment starts. When time runs out, the hold expires and the slot is free again. |
| D23 | **Paid but no booking** (the hold expired and the slot was taken while the payment went through): the candidate gets a **full refund automatically**, and a support ticket is logged so admin sees it. No offer of another slot. |
| D24 | A paid booking is **confirmed instantly**. The interviewer can't decline it. |
| D25 | The candidate's form: target role, experience level, resume, job description ("General preparation" allowed) and topics, all required. Name and email come from the account. Before the first payment of any kind, the candidate also fills in **billing details** (address with city, state and PIN code; optional GSTIN or PAN), saved to their profile (`docs/gst/spec.md` G7, G9). |
| D26 | **Resume access:** the interviewer sees the resume from booking until the evaluation is submitted, with a hard stop 2 days after the interview. The candidate agrees to this when booking. |
| D27 | Interviewers and candidates **never see each other's email or phone**. Contact happens in the meeting. |

### Google Meet, calendar and reminders

| # | Decision |
|---|---|
| D28 | **One Jobtiva Google Workspace Base account** creates every meeting, **only after a test on the 14-day trial passes**: (1) a meeting made through the Meet API with Open access, which two outside people join without knocking and with nobody from Jobtiva present; (2) a calendar event with both as guests reaches both calendars; (3) attendance can be read from conference records after the call; (4) the app connects as an internal Workspace app, with no Google verification and no 7-day token expiry. |
| D29 | **No per-user calendar connection.** The Workspace account adds both people as guests, so Google's invite puts it in their calendars. Our confirmation email attaches a calendar file for Outlook and Apple users. Reschedules and cancellations update the same event. |
| D30 | **Join interview page:** each booking has a Jobtiva page that shows the Meet link from 10 minutes before the start until the booked end time, and records each person's click time. The Meet link isn't shown anywhere else, apart from Google's calendar invite. |
| D31 | **Reminders:** 24 hours, 1 hour and 15 minutes before by default, to both people. Admin can add, edit, remove and switch each one on or off. Each links to the Join page. They're sent by the existing 5-minute cron, so they arrive within 5 minutes of their time. Google's own invite and update emails also go out; that's expected. |
| D32 | **No recording** by Jobtiva, and the Terms forbid recording without both people's consent. |

### Money

| # | Decision |
|---|---|
| D33 | **Model B: Jobtiva sells the interview.** The candidate buys from Jobtiva; Jobtiva pays the interviewer as a freelancer. Subject to the CA's confirmation. |
| D34 | Jobtiva isn't GST-registered today. **Every price shown is the final price, GST included.** Each booking records whether GST applied at the time it was made. Once registered, the interviewer's share is worked out on the price minus GST. All GST behavior (the system-wide switch, the split by state, invoices, credit notes, the admin GST panel) is defined in **`docs/gst/spec.md`**, built before Release 2. |
| D35 | **Jobtiva's share** depends on whether this is the candidate's first booking **with that interviewer** (first-time %) or a repeat (returning %). Both are admin settings. Jobtiva pays the payment gateway's fee from its own share. |
| D36 | **Every money rule is an admin setting, and the settings in force are saved onto each booking when it's made.** Changing a setting never changes past bookings. |
| D37 | **Wallet stages:** Upcoming (booked) → Earned (locked) → Withdrawable → Paid out. Earned becomes Withdrawable automatically **only** when the interviewer submits the evaluation, after a dispute window (48 hours by default). The only other way is an admin release with a written note. |
| D38 | **Withdrawals:** a manual withdrawal is possible when the withdrawable balance is above a minimum (₹500 to start), for a fee (10% to start), within a frequency limit, and **waits for admin approval**. When the withdrawable balance reaches a threshold (₹10,000 to start), the **whole balance is paid out automatically, with no fee**, within 2 working days. All values are admin settings. |
| D39 | Payouts go through **RazorpayX** (automated). Admin also has a **"record a manual payment"** fallback for when RazorpayX fails or is down. |
| D40 | Penalties and refunds are **separate ledger entries**. A negative balance is recovered from future earnings before any payout. **Money records are never edited or deleted;** a correction is always a new entry. |

### Cancellations, reschedules, no-shows

| # | Decision |
|---|---|
| D41 | **The candidate can cancel, for a 50% charge** (admin setting), shown clearly every time they book. The other 50% is **refunded automatically**. The charge is split the normal way: the interviewer's usual share of it goes to their Earned balance (the slot was theirs), and it becomes Withdrawable after the dispute window, with no evaluation needed. |
| D42 | **The interviewer cancels:** the candidate gets a full refund, and the interviewer gets a penalty (admin-set %). This is handled by admin: the candidate raises a grievance and admin settles it. |
| D43 | **Reschedule: once per booking** (admin setting), by either side, until 12 hours before (admin setting), only into the interviewer's availability and no further out than an admin-set limit. The other person must accept. If they don't, the original time stands and the normal no-show rules apply. Every reschedule is recorded. |
| D44 | **No-show:** not joined within the grace period after the start (admin setting, 15 minutes to start). |
| D45 | **Candidate no-show:** never released automatically. The interviewer raises a support ticket from the booking; admin checks the evidence, writes a review note and releases the money by hand. |
| D46 | **Interviewer no-show:** the candidate raises a complaint; admin investigates. If verified: a full refund to the candidate and a 20% penalty (admin setting) on the interviewer, as separate entries. Refunds here are done manually in the Razorpay dashboard and recorded in Jobtiva with their reference. |
| D47 | **Evidence:** Jobtiva collects Join-page click times, Meet attendance from conference records, and a short statement from each side. Admin decides. **Nothing is penalized automatically.** If the attendance data clearly shows one side never joined, the case is flagged for admin to look at first. |
| D48 | **Strikes:** only admin-verified interviewer no-shows count. Warnings at 3 and 7, block at 10 (all admin settings). No automatic reset. When admin lifts a block, admin writes a note and **chooses what the count resets to, 0 to 9**. |

### Evaluation, results, reviews

| # | Decision |
|---|---|
| D49 | **One report format for AI and human interviews.** Five metrics scored 1 to 10 (communication, technical knowledge, confidence and clarity, problem-solving, answer relevance), an overall score out of 100 from admin-set weights, and five written parts (strengths, areas to improve, questions answered wrongly or partly, better answers, what to prepare next). Every report is labeled **AI evaluation** or **Interviewer evaluation**, never mixed. |
| D50 | The interviewer has **48 hours** to submit (admin setting), with reminders at 24 and 40 hours. After 40 hours the candidate can also **ping** for it (email plus in-app notification to the interviewer). After the deadline, admin sees it as overdue. |
| D51 | **Submitting is deliberate and final:** the interviewer types a confirmation word, then enters an emailed code. No edits afterwards. The form autosaves a draft until then. |
| D52 | The candidate can flag an evaluation to support; it changes the money only if admin finds misconduct. |
| D53 | Performance page: a trend chart per metric across attempts, filterable by AI or human. |
| D54 | **Reviews:** one per completed booking, any time after completion. Interviewers can reply once, publicly. Stars show from the first review. A **"New"** tag shows until N bookings or N days (both admin settings, 10 and 10 to start). Admin moderates. The review rating is separate from the candidate's performance scores. |

### Admin, legal and content

| # | Decision |
|---|---|
| D55 | You handle disputes and payouts alone for now. Every money action needs a written note and goes in a permanent audit log. One **release review** screen handles every money decision (candidate no-show, interviewer no-show, disputes, credits). |
| D56 | Admin dashboard: money collected, Jobtiva's share, payouts due, pending evaluations, open disputes, no-show counts, AI interview usage and cost, and **yearly turnover against the ₹20 lakh GST registration line**. |
| D57 | New public pages: the module landing page, an **Interviewer Agreement** (I draft, a lawyer checks), a booking cancellation and refund policy (updating the Refunds page), and Privacy Policy additions: resumes shared with interviewers, and **one general line, for AI interviews only**, that answers are processed by an AI service to produce feedback. The homepage's "your own AI key" wording stays accurate for the job tracker and isn't stretched to cover mock interviews. |
| D58 | "Report this profile" and "Report this candidate" both create a support ticket. |

---

## 2. Journeys

### 2a. Candidate: AI mock interview (Release 1)

1. **Mock interviews → AI mock interviews → New interview.** Pick role, industry, category, difficulty and duration; add or pick a resume, job description (or "General preparation") and topics. From a lead with status Interview, "Prepare for this interview" fills these in.
2. **Allowance check.** If the plan's allowance has one left, start. If not, show the price and pay through Razorpay (same checkout as plans).
3. **The interview.** A chat screen: the AI asks, the candidate answers, the AI follows up. A timer shows time left. At the end of the duration the AI wraps up, with up to 10 extra minutes.
4. **If the connection drops,** the candidate can resume within 15 minutes from where it stopped.
5. **Results.** The evaluation appears on the shared report page and in Interview history; Performance updates.

### 2b. Candidate: human mock interview (Release 2)

1. **Find an interviewer:** filters (D20), sorted per D19.
2. **Profile:** experience, skills, rating and reviews, and the list of services.
3. **Service page:** details, price, duration, language, what to prepare, and the cancellation rule (50% charge) in plain words.
4. **Pick a slot,** shown in the candidate's timezone.
5. **Booking form** (D25), plus agreeing to resume sharing (D26) and the cancellation rule.
6. **Pay within 10 minutes** (D22). If the page closes, My bookings shows the pending booking with a Pay button until it expires.
7. **Confirmed:** confirmation email with a calendar file; Google's invite arrives; reminders follow (D31).
8. **Join:** the Join interview page opens 10 minutes before.
9. **After:** the report appears when the interviewer submits; the candidate can ping after 40 hours, review the interviewer, flag the evaluation or raise a complaint.
10. **Change of plan:** one reschedule (needs the interviewer's acceptance) or cancel with the 50% charge.

### 2c. Interviewer (Release 2)

1. **Become an interviewer** (in Mock interviews): the onboarding form, PAN and bank, agree to the Interviewer Agreement. Status: pending.
2. **Approved** (or asked for more information, or rejected): email plus notification.
3. **Set up:** profile, handle, services, weekly availability, blocked dates, limits.
4. **Bookings:** each with the candidate's details, resume (D26), topics and Join page.
5. **After each interview:** submit the evaluation (D51). Earned → Withdrawable after the dispute window.
6. **Wallet:** Upcoming, Earned, Withdrawable, Paid out, with every deduction on its own line. Request a manual withdrawal or wait for the automatic payout.
7. **Problems:** candidate no-show → raise a ticket from the booking; reschedule requests; reviews and replies.

The interviewer area is a separate part of the dashboard (switch between your normal dashboard and the interviewer area), not a separate site or login.

### 2d. Admin

- **Applications:** review, approve, reject, ask for more information, suspend, deactivate.
- **Bookings:** every booking with its status, payment, Meet link, Join clicks and attendance.
- **Release reviews:** one screen for every money decision. It shows evidence and a checklist, and needs a note.
- **Payouts:** approve or reject manual withdrawals, watch automatic payouts and failures, record manual payments.
- **Refunds:** automatic ones (cancellations, paid-but-no-booking) and manual ones with their Razorpay reference.
- **Strikes:** verified no-show counts, warnings, blocks, lifting with a reset value.
- **Reviews:** moderation.
- **Catalog:** categories, designations, skills, industries, languages.
- **AI interviews:** usage and cost, sessions with their event log, credits.
- **Module settings** (section 4).

---

## 3. States

Booking, payment, evaluation and wallet states are tracked **separately**, never squeezed into one status.

**Booking:** Pending payment → Confirmed → (Reschedule requested → Confirmed) → In progress (from start time) →
Awaiting evaluation → Completed. Side exits: Expired (hold ran out), Cancelled by candidate, Cancelled by
interviewer, Candidate no-show (reported), Interviewer no-show (reported), Under review, Closed.

**Payment:** Created → Paid → Partly refunded / Refunded. Plus "Paid, no booking" → Refunded (D23).

**Evaluation:** Not started → Draft → Submitted. Overdue is shown after the deadline.

**Wallet entries (ledger):** booking earning (Upcoming), earning locked (Earned), released (Withdrawable),
withdrawal fee, payout, penalty, recovery, reversal. Balances are always **calculated from entries**, never
stored as a single editable number, and never taken from the payment gateway's balance.

---

## 4. Admin settings (module settings page)

Saved onto each booking or session when it's created (D36). Defaults in brackets.

| Area | Settings |
|---|---|
| Switches | AI interviews on/off; marketplace on/off; new interviewer applications on/off; pause new bookings |
| AI interviews | AI provider, model and key for this module; categories; difficulty levels; allowed durations (15, 30, 45, 60); minutes per question (2); wrap-up extension (10 min); resume window (15 min); price with no active plan; prompts; metric weights |
| Plans (in the plan editor) | AI interviews included; price per extra AI interview |
| Commission | First-time % ; returning % |
| Pricing | Minimum and maximum service price; allowed durations (15, 30, 45, 60, 90); services per interviewer |
| Booking | Payment hold (10 min); defaults and allowed ranges for notice (12 h), buffer (15 min), bookings a day (4), horizon (30 days); Join page opens (10 min before) |
| Reminders | The list: time before, on/off |
| Cancellation and reschedule | Candidate cancellation charge (50%); reschedules per booking (1); reschedule cutoff (12 h); furthest new date (admin-set); interviewer cancellation penalty % |
| No-shows | Grace period (15 min); interviewer no-show penalty (20%); warnings (3, 7); block (10) |
| Evaluation | Deadline (48 h); reminder times (24 h, 40 h); candidate ping from (40 h) |
| Earnings and payouts | Dispute window (48 h); manual minimum (₹500); manual fee (10%); manual frequency limit; automatic threshold (₹10,000); payout promise shown ("within 2 working days") |
| Discovery | New-interviewer boost (N days); "New" tag (10 bookings, 10 days) |
| Catalog | Categories, designations, skills, industries, languages |

**Not settings, on purpose:** evaluation (or an admin release with a note) is the only way to Withdrawable;
penalties and refunds are separate entries; only verified no-shows count; every money action is logged.

---

## 5. Emails (all registered in Email templates)

Every automatic email below is added to **admin Engagement → Email templates** with its placeholders and default
wording, per the project rule. Release 1 needs only the first group.

- **AI interviews:** AI interview purchase receipt (or the existing receipt template extended); feedback ready.
- **Interviewer status:** application received; approved; more information needed; rejected; suspended; deactivated; no-show warning; blocked; block lifted.
- **Bookings:** booking confirmed (candidate, with calendar file); new booking (interviewer); reminder (both); reschedule requested; reschedule accepted; reschedule declined; cancelled by candidate (both); cancelled by interviewer (both); payment received but no booking (candidate, with refund).
- **Evaluation:** evaluation due (24 h, 40 h); candidate's ping; evaluation submission code; report ready (candidate); review request (candidate).
- **Money:** earnings released; withdrawal requested; withdrawal approved; withdrawal rejected; payout sent; payout failed; refund issued; penalty applied.
- **Disputes:** complaint received; release review decided (both sides).

Admin alerts (new application, new dispute, payout failure, a block) use the existing admin notifications.

---

## 6. How it's built (outline; detailed per phase)

**AI interviews.** `lib/ai.ts` gets a module-key path next to the user-key and admin-key paths (D9). A session
keeps its settings snapshot, the conversation and an event log. The server paces questions against the
duration (D10) and enforces the 10-minute wrap-up. The evaluation is one structured AI call validated with Zod
against the shared report schema (D49). Token use and cost are recorded per session for D56.

**Slots and race conditions.** Holding a slot locks the interviewer's row inside a transaction and checks for
overlapping active bookings (pending or confirmed) before inserting. That's enough at our scale. A Postgres
exclusion constraint would be stronger but needs the `btree_gist` extension: **ask before adding it.**

**Payments.** The existing Razorpay setup (orders, verification, webhook) gets new purchase types: AI
interview and booking. Webhooks stay signature-checked and idempotent. A paid webhook for an expired hold
triggers D23. Refunds for D41 and D23 use Razorpay's refund API; D46 refunds are recorded by hand.

**Meet.** A server-side Google client for the Workspace account (internal app), only after the D28 test.
Event created with both guests and a Meet link; reschedule and cancel update it; after the meeting, conference
records are fetched for attendance.

**Reminders and timers.** The existing 5-minute cron runs reminders, hold expiry, evaluation reminders and
deadlines, dispute-window releases and automatic payouts.

**Payouts.** RazorpayX payouts from Jobtiva's RazorpayX account, idempotent per payout, with status
webhooks. Manual record fallback (D39).

**Confirmation codes.** The existing action-code system (`lib/action-codes.ts`) issues the evaluation
submission code (D51).

**Tickets.** `createSupportTicket` (`lib/tickets.ts`) is used for no-show reports, complaints and D23.

**Data model.** Written in each release's database phase, from what the screens need (project rule). Expected
tables: module settings; AI sessions, messages and events; evaluations (shared by AI and human); interviewer
profiles, services, availability and blocked dates; bookings and booking events; join clicks and attendance;
ledger entries; withdrawal requests and payouts; release reviews; reviews; strikes; catalog lists. New log
tables are added to Data retention.

---

## 7. Security and privacy

- Every page and Server Action checks the session; interviewer pages also check the interviewer role and
  approval; every query is scoped by `user_id` or booking participant.
- All inputs validated with Zod before touching the database.
- Resumes are visible only to the booked interviewer, only within D26's window, never by public link.
- No email or phone shared between candidate and interviewer (D27).
- PAN and bank details encrypted at rest like other secrets; only the last 4 digits shown.
- The module AI key, Workspace credentials and RazorpayX keys live encrypted in the database, admin-entered,
  write-only on screen.
- Webhooks verified and idempotent. Money actions in an append-only ledger and audit log.
- A pre-deploy check script per release, like the existing `scripts/security/*-checks.mts`.

---

## 8. Owner actions (outside the code)

| When | Action |
|---|---|
| Before Release 2 | **CA:** confirm Model B; when GST registration becomes mandatory (turnover counts the full booking price under Model B); TDS on interviewer payouts; what a candidate's invoice must show; the GST questions in `docs/gst/spec.md` section 7 |
| Before Release 2 | **Lawyer:** Interviewer Agreement; booking cancellation and refund policy, including the 50% candidate charge; Privacy Policy additions |
| Start early (approval takes time) | **Apply for RazorpayX** (current account, business KYC) |
| At Release 2's first phase | **Google Workspace Base 14-day trial** on jobtiva.in for the Meet test (D28); buy only if it passes |
| Release 1 | Provide the module's **AI key** (entered in admin by you, never in chat) |

---

## 9. Roadmap

Each release runs in our usual order: **screens on sample data → database → wiring → safety checks → content and
rollout**, user side before admin, checked at 375 and 768 px, with an owner checkpoint after each phase.

### Release 1: AI mock interviews (text)

| Phase | Work |
|---|---|
| 1. Screens | Navigation with two main menus (Lead management, Mock interviews), including the phone menu and onboarding tour; New interview; the interview chat; the shared report page; Interview history; Performance; plan editor fields; admin module settings; admin AI interview usage and sessions; landing page draft |
| 2. Database | Settings, sessions, messages, events, evaluations, plan columns, AI interview purchases |
| 3. Wiring | Module AI key; the interviewer loop with pacing and wrap-up; evaluation; allowance and purchase; resume within 15 minutes; usage and cost; "Prepare for this interview" on leads |
| 4. Safety | Check script (access, allowance can't be bypassed, evaluation schema, purchase idempotency); knowledge-base articles |
| 5. Content and rollout | Landing page and homepage links; Privacy line for AI interviews; emails registered; you deploy preprod → prod |

### Between the releases: GST and invoices

The system-wide GST work in `docs/gst/spec.md` (switch, admin GST panel, billing details, tax split by state,
invoices and credit notes, reports) is built after Release 1 and before Release 2.

### Release 2: human mock interviews

| Phase | Work |
|---|---|
| 0. Tests | Google Meet test on the Workspace trial (D28); RazorpayX payouts in test mode |
| 1. Screens | Candidate: find, profile, service, slot, form, pay, My bookings, Join page, report, review, complaint. Interviewer: onboarding, profile, services, availability, bookings, evaluation form, wallet, withdrawals, reviews. Admin: applications, bookings, release reviews, payouts, refunds, strikes, reviews, catalog, settings, dashboard |
| 2. Database | Section 6's marketplace tables, ledger and audit log |
| 3. Wiring | Holds and bookings, payment and refunds, Meet, reminders, evaluation with code, ledger and wallet, withdrawals and RazorpayX payouts, cancellations and reschedules, no-show handling, strikes, reviews |
| 4. Safety | Ledger checks (balances always equal the sum of entries; no double release), race tests on slot holds, webhook replay tests, access tests |
| 5. Content and rollout | Interviewer Agreement, policies, landing page update, knowledge-base articles, emails; you deploy |

### Later (not scheduled)

Voice AI interviews; recommendations from tracked leads; packages; finance-only admin roles; Meet attendance
reports (needs a higher Workspace plan).

---

## 10. Still open

- **Paid plans' AI allowance:** is it granted per plan period (each purchase or renewal), and does unused
  allowance carry over? Assumed: per period, no carry-over.
- **Price of an AI interview with no active plan:** assumed to be a module setting (section 4).
- The furthest date a reschedule can move to (D43): default to be set in admin; I'd start at 30 days from the
  original date.
- The rest of the interviewer onboarding fields, settled at UI time (D14).
