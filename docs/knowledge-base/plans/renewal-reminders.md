---
title: Plan-ending reminder emails
category: Plans and billing
summary: Users get one email a day in the last 7 days of their plan or free trial, around 10:00 IST. Each one mentions how many leads they're tracking and suggests the next plan up. They stop once the user renews.
keywords: reminder, renewal email, plan ending, expiry email, upsell, trial ending, 7 days, no unsubscribe
---

A plan can quietly run out on someone who's busy with interviews, so Jobtiva emails them every day for the last week: 7 days before, 6, and so on down to "ends tomorrow". The free trial gets the same treatment.

The email names the date the plan ends and, if they have any, how many job leads they're tracking right now. It also suggests the next plan up, the cheapest listed plan priced above theirs, with what it adds and its monthly price. Paid users are reminded that upgrading early counts their remaining days toward the new plan. The button goes to Settings → Plan for paid users and to Upgrade Plan for trial users.

It stops by itself once they renew, because their new expiry is no longer within 7 days. Admin accounts and deactivated users never get it.

These are account emails, so there's no unsubscribe link. They go through the SMTP settings in Settings → Email / SMTP. If email isn't set up, the send is recorded as failed and retried on the next run.

## When they go out

The server's scheduled job calls the reminders once a day at 10:00 IST. Running it twice on the same day doesn't send anything twice, because each user, plan end date and day is only ever sent once. If a day is missed, the user gets the next day's email as usual. Missed days aren't caught up.

There's one wording for now. A section to preview and edit email templates is planned.
