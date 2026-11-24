---
title: Interview practice on leads (practice panel, interview dates, practice to-do, Interviews coming up)
category: Leads and automation
summary: While AI mock interviews are open, every lead links to practice for that job. The lead page shows past practices and the latest score with its change, cards get a Practiced chip, and moving a lead to Interview offers a practice right away.
keywords: practice, mock interview from lead, readiness, practiced filter, prepare for interview, interview coming up, practice now, score trend
---

A user with a real interview coming up shouldn't have to go looking for the practice feature. So the lead side now points at it wherever a lead shows up. All of it depends on the **AI interviews** switch in Mock interviews → Module settings → Availability. On Coming soon, none of what's below appears, and a saved "Practiced" filter stops doing anything.

## Which practices belong to a lead

A practice belongs to a lead when it was booked for that lead: either the booking form was opened from the lead (anything below that says "Practice"), or the user picked the lead as the job description. The booking keeps the lead's name ("Role at Company"), so the history still reads right after the lead is deleted. Unpaid and expired bookings never show on the lead side.

## On the lead page

The practice panel sits under the lead's title on every open stage. At the Interview stage it's highlighted, and until there's a score its heading asks "Interview coming up?". The buttons:

| Button | When |
|---|---|
| Start booked practice | A practice for this lead is booked but not started |
| Resume practice | One is in progress or paused |
| Practice for this job | No practice yet. Opens the booking form filled in from the lead |
| Practice again | There's already one |

Below the buttons, a table lists the lead's practices with their score, level, length, date and status, and a View report, Start or Resume button on each. Closed and discarded leads keep the table if they have practices, without the buttons.

The score shown is the **latest** scored practice (owner's choice, November 24, 2026), with an arrow and the change from the scored one before it, as a percentage of that earlier score. Going from 60 to 72 shows "↑ 20%". Going from 80 to 70 shows "↓ 13%". With only one score there's no arrow.

## On cards, filters and menus

Once a practice is done, the lead's card (list and board) gets a **Practiced** chip with the latest score and the arrow. A practice whose report isn't written yet shows "Practiced · report soon". Leads with no finished practice get no chip, to keep cards quiet.

The Filters drawer on the list and the board has an **Interview practice** filter: All leads, Practiced, or Not practiced yet. "Practiced" means at least one practice scored or waiting for its report.

Every ⋯ menu on a lead (list card, board card and lead page) has **Practice interview**, which opens the booking form for that lead.

## When a lead moves to Interview

Moving a lead to Interview by hand (the status menu, the **Mark as Interview** button or dragging on the board) shows a "Moved to Interview" message asking to practice now, with a **Practice now** button. It asks every time, even for a lead that has been to Interview before. Closing the message is the "not now", and it goes by itself after about 12 seconds. Automatic status moves don't ask.

## Interviews coming up

The AI mock interviews page has an **Interviews coming up** table: every lead at the Interview stage, with where its practice stands and a button to practice, start or resume. Ready to action shows the first three at the top, with See all. Leads don't have interview dates yet, so the most recently active lead comes first.

## Timeline, history and reports

Each practice is an entry on the lead's Timeline tab. A scored one reads like "Practiced: Medium, 30 min, scored 72", lists the report's first two things to improve and links to the report.

Interview history and each report show "For Role at Company · Open lead". History can be filtered by company, including "Not for a lead", and the search box matches the lead's name too. In a row's ⋯ menu, **Book a similar one** fills the form from the same lead. There's no Open lead link once the lead is deleted, or while the user's plan has ended, because lead pages are locked then. The name still shows.

There's nothing for an admin to set here. Everything comes from the lead stored on each booking.

## Interview dates, the practice to-do and smarter booking

Moving a lead to Interview now opens a small window asking when the interview is (optional), with **Practice now** while AI interviews are open. The date can also be added or changed on the lead page, and in the When column of Interviews coming up, which lists dated interviews first, soonest first.

A lead whose interview is still ahead never goes stale, and the daily rules and old-lead cleanup leave it alone. Once the date passes, the usual rules apply again. Less than a day before the interview, the bell shows one reminder (sent by the mock interview upkeep job, which runs every 5 minutes). Changing the date earns a fresh reminder.

Reaching Interview also adds a "Practice for Role at Company" to-do (kind Practice), due the day before the interview when there's a date. It ticks itself off when a practice for that lead gets its report. It's only added while AI interviews are open.

Booking from a lead guesses the industry from the job description when it's clear, and **Suggest topics from this job** fills in topics. It uses the user's own AI key when they have one, and plain keyword matching when they don't or the AI reply can't be used. Each booking keeps the lead's company. The interviewer is told it, and admins can use `{{company}}` in Module settings → Prompts.
