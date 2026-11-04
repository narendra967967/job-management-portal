---
title: The scheduled jobs on the server and what each one does
category: Runbooks
summary: The server's crontab calls protected app routes on a schedule: Gmail sync every 15 minutes, the AI alert reader every 5 minutes, and once a day the cleanup rules, lead retention and data retention, followed by the backup.
keywords: cron, crontab, scheduled jobs, daily job, sync, purge, backup, cron secret, quiet hours, run now
---

Scheduled work runs from the `deploy` user's crontab on the server, for prod and preprod each. The server clock is UTC. Each job calls a route in the app with that environment's secret, and the route refuses anything without it.

| Schedule (UTC) | Job | What it does |
|---|---|---|
| Every 15 minutes | sync | Gmail sync, for users connected that way. Each user is synced on their own interval, and nothing runs during quiet hours |
| Every 5 minutes | ai | Picks up alerts waiting for the AI reader, including retries |
| 21:00 prod, 21:10 preprod | purge | The automatic lead cleanup rules, then Lead retention if switched on, then Data retention |
| 21:30 | backup | Backs up both databases and uploaded files, locally and to Google Drive |

21:00 UTC is 2:30 in the morning in India.

## Running a job now

As the deploy user in `/srv/jobtiva`: `./cron-run.sh prod purge`, or `sync` or `ai`, and `preprod` for the other environment. Output goes to `logs/cron.log`.

## If a job seems not to run

Check `logs/cron.log` first. The crontab lives in `crontab.txt` in the deploy kit and is installed with `crontab /srv/jobtiva/crontab.txt`. After changing it, install it again.
