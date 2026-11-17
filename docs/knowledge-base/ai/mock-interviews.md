---
title: AI mock interviews (Module settings, sessions and giving one back)
category: AI
summary: Admin → Mock interviews holds the module's settings and every AI interview session. A booking keeps the settings it was made under, so changes only affect new ones. Candidates see Coming soon until the interviewer is connected.
keywords: mock interview, interview prep, practice interview, credit, refund interview, give back, allowance, interview price, coming soon, module settings
---

AI mock interviews live under **Admin → Mock interviews**. There are two screens today: **Module settings** and **AI interviews**. Interviewers, Bookings and Payouts are for the human-interviewer release and show "soon".

## What candidates see right now

The **AI interviews** switch in Module settings → Availability decides whether candidates get the feature or a Coming soon page. Until the AI interviewer itself is connected (roadmap R1.5), production keeps showing Coming soon even if you switch it to Open. That stops anyone booking an interview that can't run yet. On a developer machine, Open shows the screens so they can be checked.

The same switch hides "Prepare for this interview" on leads at the Interview stage.

## Module settings

Each section has its own **Save changes** button and only saves that section.

| Section | What it sets |
|---|---|
| Availability | Open or Coming soon for AI interviews and for human interviews. Changing the AI switch asks you to confirm. Interviewer applications and Pause new bookings are for the human release |
| AI service | Provider, model and the module's own API key. The key is stored encrypted and only its last four characters are shown. Leave the box empty to keep the saved key |
| Interview rules | Kinds of interview, the lengths candidates can pick (15, 30, 45, 60 minutes), minutes per question (sets how many questions are planned), wrap-up extension, the resume window after a disconnection, and the pace grace period |
| Pricing | A rate per minute for Easy, Medium and Hard, each with its own discount switch and percentage. The preview shows what each length costs |
| Bookings | How many days a booking stays valid, and how many days before expiry the reminder goes out (0 sends none) |
| Scoring | The weight of each of the five skills in the overall score. They must add up to 100% |
| Prompts | The question plan, interviewer and evaluation prompts. **Reset to default** puts the built-in wording back |

**Changes never touch existing bookings.** When a candidate books, the booking keeps a copy of the timing rules, its level's price and the weights in force at that moment. So raising a price or changing the wrap-up time only affects bookings made after you save.

The module key is separate from users' own AI keys and from the knowledge base key, so mock interview usage and cost are tracked on their own. Candidates don't need an AI key of their own for mock interviews.

## Plans and the allowance

The plan editor has **AI mock interviews included**. On a paid plan it's granted with each purchase or renewal, and unused ones don't carry over. On the Free plan it's once ever. A renewal or upgrade starts a fresh count. Anything beyond the allowance is paid per minute at the level's rate (paying arrives with the AI interviewer in R1.5).

## The AI interviews screen

It lists interviews that have started, from the last 7 days by default. The boxes along the top filter by status, and below them are the totals for what candidates paid, the AI cost, tokens and minutes completed. The chart switches between sessions per day and AI cost per day. Select rows to export them as CSV.

**View event log** on a row shows what happened during that interview: when it started, each question, disconnections, a resume, the wrap-up, the end and any errors. Read it before deciding on a give-back. Event logs are trimmed by Settings → Data retention (AI interview event logs); the interview and its report stay.

## Giving an interview back

For an interview that **stopped early** or **failed**, the row menu has **Give interview back**. It creates a new booking with the same setup (role, kind, level, length, resume and job description) at no charge, valid for the current booking validity. No money moves; it isn't a refund.

You must write a reason of at least 10 characters. It's kept on the new booking along with who gave it back. Each interview can be given back once; a second attempt is refused, even from a double click.
