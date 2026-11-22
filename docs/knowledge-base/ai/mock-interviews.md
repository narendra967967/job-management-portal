---
title: AI mock interviews (Module settings, sessions and giving one back)
category: AI
summary: Admin → Mock interviews holds the module's settings and every AI interview session. A booking keeps the settings it was made under, so changes only affect new ones. The Availability switch alone decides what candidates see.
keywords: mock interview, interview prep, practice interview, credit, refund interview, give back, allowance, interview price, coming soon, module settings
---

AI mock interviews live under **Admin → Mock interviews**. There are two screens today: **Module settings** and **AI interviews**. Interviewers, Bookings and Payouts are for the human-interviewer release and show "soon".

## What candidates see right now

The **AI interviews** switch in Module settings → Availability decides whether candidates get the feature or a Coming soon page, in every environment. It starts on Coming soon, so a new environment stays closed until you open it there. Leave prod on Coming soon until the roadmap's rollout step.

The same switch controls the public side. While it's open, the landing page at `/ai-mock-interviews` is live and linked from the homepage (a band under Features), the header (Mock interviews), the footer, the pricing page (a plan row and a price question), the sitemap and `/llms.txt`. On Coming soon the page is a 404 and every one of those links disappears. Its kinds of interview, lengths and per-minute prices come straight from Module settings, so changing a price changes the page. Signed-out visitors who press Book an interview go to the login page and land on the booking form after signing in. The page's sample report is made up, and its skill bars show words (Strong, Solid, Work on) rather than scores, so it never reveals how Module settings → Scoring weights the overall score.

The Privacy Policy covers AI interviews while they're open, and permanently once anyone has booked one: what an interview stores, what goes to the module's AI service, that spoken answers are turned into text by the browser's own speech service (the app never gets audio), and how long the event logs are kept (Settings → Data retention).

When it's open, the AI mock interviews page starts with a **Get ready** checklist while anything is missing:

| Item | Ready when | If not |
|---|---|---|
| An interview to use | The plan has included interviews left, or online payment is available | Needed to book. Links to the plan page |
| Resume | A saved resume with readable text (300+ characters) | Recommended. They can still paste one while booking |
| Career profile | The profile is complete | Recommended. The interviewer reads target roles, skills, experience and seniority |
| A real interview coming up | A lead is at the Interview stage | Optional. Offers "Prepare for it" for that lead |

Once everything is ready and they have bookings, it folds into one line.

The same switch hides "Prepare for this interview" on leads at the Interview stage.

## Module settings

Each section has its own **Save changes** button and only saves that section.

| Section | What it sets |
|---|---|
| Availability | Open or Coming soon for AI interviews and for human interviews. Changing the AI switch asks you to confirm. Interviewer applications and Pause new bookings are for the human release |
| AI service | Provider, model, the module's own API key, and what the provider charges in ₹ per million input and output tokens. The key is stored encrypted and only its last four characters are shown; leave the box empty to keep it. **Test connection** sends a tiny request with the saved key |
| Interview rules | Kinds of interview, the lengths candidates can pick (15, 30, 45, 60 minutes), minutes per question (sets how many questions are planned), wrap-up extension, the resume window after a disconnection, and the pace grace period |
| Pricing | A rate per minute for Easy, Medium and Hard, each with its own discount switch and percentage. The preview shows what each length costs |
| Bookings | How many days a booking stays valid, and how many days before expiry the reminder goes out (0 sends none) |
| Scoring | The weight of each of the five skills in the overall score. They must add up to 100% |
| Prompts | The question plan, interviewer and evaluation prompts. **Reset to default** puts the built-in wording back |

**Changes never touch existing bookings.** When a candidate books, the booking keeps a copy of the timing rules, its level's price and the weights in force at that moment. So raising a price or changing the wrap-up time only affects bookings made after you save.

The module key is separate from users' own AI keys and from the knowledge base key, so mock interview usage and cost are tracked on their own. Candidates don't need an AI key of their own for mock interviews.

## Plans and the allowance

The plan editor has **AI mock interviews included**. On a paid plan it's granted with each purchase or renewal, and unused ones don't carry over. On the Free plan it's once ever. A renewal or upgrade starts a fresh count. Anything beyond the allowance is paid per minute at the level's rate, through the same Razorpay checkout as plans. The price includes GST. The booking only counts once the payment is confirmed with Razorpay, its validity starts at payment, and the receipt is the "AI interview payment received" email. A booking whose payment never goes through disappears after a day; its order stays in Orders & payments as cancelled or failed.

## How an interview runs

1. The candidate presses **Start interview** on the briefing page. The AI writes a question plan sized to the length (length ÷ minutes per question), covering their topics. It reads the resume, the job description and the candidate's career profile (the report uses the profile too). If that fails, the booking stays ready and nothing is used up.
2. Questions come one at a time. After each answer the AI either asks a follow-up (at most two per question) or moves to the next planned question. If the AI doesn't reply, the next planned question is asked as written, so the interview carries on.
3. **The clock only counts connected time.** The screen checks in every 15 seconds. If nothing arrives for 45 seconds, the candidate counts as disconnected and the clock stops where it was.
4. A disconnected candidate has the resume window (15 minutes by default) to come back. After that the interview closes with the answers so far and is scored on those.
5. When the time is up, the wrap-up starts: no new planned questions, and the interview ends when the AI closes it or the wrap-up time runs out.
6. The report is written right after. If the AI reply doesn't fit the report format it's retried; if it still fails, the upkeep job tries again (up to six times) and the interview shows as waiting for its report. The candidate gets an "Interview report ready" email.

An interview that ends with no answers at all (ended straight away, or never resumed) has nothing to score and no report. Here it shows as **Failed**, so you can give it back. The candidate sees it as **Ended before answering**, with a Book again button. An interview stopped by a problem on our side (the AI not answering) shows to the candidate as **Stopped by a problem**, with a link to support.

Every AI call adds its tokens to the interview, and the cost uses the token prices in AI service at that moment.

## The upkeep job

Every 5 minutes the server runs **Mock interview upkeep** (job "interviews"). It closes interviews not resumed in time, retries reports that failed, marks unstarted bookings as expired once their date passes, sends the "booking expires soon" email (Module settings → Bookings; 0 turns it off) and clears unpaid bookings older than a day.

## The AI interviews screen

It lists interviews that have started, from the last 7 days by default. The boxes along the top filter by status, and below them are the totals for what candidates paid, the AI cost, tokens and minutes completed. The chart switches between sessions per day and AI cost per day. Select rows to export them as CSV.

**View event log** on a row shows what happened during that interview: when it started, each question, disconnections, a resume, the wrap-up, the end and any errors. Read it before deciding on a give-back. Event logs are trimmed by Settings → Data retention (AI interview event logs); the interview and its report stay.

## Giving an interview back

For an interview that **stopped early** or **failed**, the row menu has **Give interview back**. It creates a new booking with the same setup (role, kind, level, length, resume and job description) at no charge, valid for the current booking validity. No money moves; it isn't a refund.

You must write a reason of at least 10 characters. It's kept on the new booking along with who gave it back. Each interview can be given back once; a second attempt is refused, even from a double click.

## What's enforced on the server

None of these rely on the screens hiding a button:

- **Coming soon closes everything.** With AI interviews on Coming soon, every AI interview page shows the Coming soon panel, and booking, editing a booking, starting, answering and ending are all refused, even for bookings made while it was open. Receipts for interviews already paid can still be emailed.
- **Each candidate sees only their own.** Every booking, interview, report and receipt is looked up with the signed-in account, so someone else's link shows nothing.
- **The allowance is counted under a lock.** Two bookings made at the same moment can't both take the last included interview. The price comes from Module settings on the server; the browser can't send a price, a discount or "covered by my plan".
- **A paid booking is charged once.** Razorpay's confirmation and the webhook can both arrive. The first one books the interview and sends the receipt; later ones change nothing. A payment for the wrong amount or another order is refused.
- **A report is saved only in the report's format.** If the AI's reply has a score outside 1 to 10, a missing part or no JSON, it's tried again, and after three failures the interview waits for the upkeep job to retry rather than getting a broken report.
- **The module key stays on the server.** Module settings shows only its last four characters.

`scripts/security/mock-interviews-checks.mts` tests all of this. Run it before deploying Mock interviews changes (see the deploy runbook).
