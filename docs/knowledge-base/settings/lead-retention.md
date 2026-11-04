---
title: Lead retention: deleting very old leads for good
category: Settings and data
summary: Auto-delete stale leads, in admin Settings → Cron & schedule, permanently deletes leads in chosen statuses with no activity for a set number of days. It's off by default, every run is logged, and affected users are emailed.
keywords: lead retention, auto-delete stale leads, purge, delete old leads, permanent delete, lead purge history
---

This is separate from the daily cleanup rules. Those close or discard leads and can be undone. Lead retention **deletes leads for good**.

It's set in **admin Settings → Cron & schedule**:

| Setting | Meaning |
|---|---|
| Auto-delete stale leads | Off by default |
| Delete leads older than (days) | Measured from last activity, 90 by default |
| Applies to statuses | Only leads in these statuses are deleted |

It runs in the daily cron job and is skipped while switched off.

## Every run is accounted for

Before deleting anything, each run records the policy and how many leads were removed per user and status, in the lead purge history (kept 365 days by default). Each affected user then gets an email and a bell notification with the counts and the policy. The email presents it as routine cleanup, so the user doesn't need to do anything.

Deleted leads can't be brought back, except from a database backup.
