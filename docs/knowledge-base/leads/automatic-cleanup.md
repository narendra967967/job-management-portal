---
title: How the daily automatic lead cleanup works
category: Leads and automation
summary: Once a day, each user's cleanup rules close, discard or shortlist leads that have gone quiet or scored badly. Every move says why on the card and can be undone, and the rules are set per user in Settings → Follow-ups.
keywords: closed automatically, discarded automatically, cleanup rules, auto close, likely filled, job position closed, no response, low fit, strong fit, undo, reopened
---

Roles get filled while leads sit untouched, so once a day the system moves quiet leads along. Each user has their own rules in **Settings → Follow-ups**, under **Automatic cleanup**. Every rule has its own switch and number, and all are on by default.

| Rule | Applies to | Default | What happens |
|---|---|---|---|
| Never touched | New | No activity for 30 days | Closed as Job position closed |
| Shortlisted and forgotten | Shortlisted | No activity for 45 days | Closed as Job position closed |
| Applied, no outreach | Applied | No activity for 45 days | Closed as No response |
| Follow-ups used up | New, Shortlisted, Applied | Follow-ups sent, no reply, 14 quiet days | Closed as No response |
| Low fit | New, Shortlisted | Score under 40, 7 days after scoring and since the last activity | Discarded |
| Strong fit | New | Score 80 or above | Moved to Shortlisted |

"Job position closed" here is a guess, since we can't see whether a role was really filled. The card says "likely filled" for that reason.

## What the rules never touch

- Top Choice leads
- Leads with a pending reminder or an open to-do
- Interview and Offer Received leads
- Leads the user moved back by hand

Score rules use the user's default resume and only apply to leads they've already scored. Nothing is scored automatically, so no AI credit is spent.

## Undoing and reopening

Every moved card says why, such as "Closed automatically: no activity for 30 days, so the role has likely been filled", with an **Undo** button. The Timeline keeps it too. If the user undoes a move, that rule never touches the lead again.

If a lead closed for going quiet shows up in a new alert, it reopens by itself, because the role is clearly still advertised. Leads closed by the Low fit rule don't reopen this way, since a new alert doesn't change the score.

## When it runs

The rules run in the daily cron job, the same one that runs Data retention, before anything else in that job. Each user who had something moved gets one notification in the bell summarizing what moved, not one per lead. The move history is kept for the period set in admin Settings → Data retention (365 days by default), except moves a user undid, which stay with the lead so the rule stays off it.
