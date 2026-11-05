---
title: The scheduled jobs on the server and what each one does
category: Runbooks
summary: The server's crontab calls protected app routes: Gmail sync every 15 minutes, the AI alert reader and the broadcast sender every 5 minutes, and once a day the cleanup and retention jobs, then the backup.
keywords: cron, crontab, scheduled jobs, daily job, sync, purge, backup, broadcasts, scheduled broadcast, cron secret, quiet hours, run now
---

Scheduled work runs from the `deploy` user's crontab on the server, for prod and preprod each. The server clock is UTC. Each job calls a route in the app with that environment's secret, and the route refuses anything without it.

| Schedule (UTC) | Job | What it does |
|---|---|---|
| Every 15 minutes | sync | Gmail sync, for users connected that way. Each user is synced on their own interval, and nothing runs during quiet hours |
| Every 5 minutes | ai | Picks up alerts waiting for the AI reader, including retries |
| Every 5 minutes (prod at :02, :07…, preprod at :04, :09…) | broadcasts | Starts scheduled broadcasts that are due and sends queued broadcast emails, one every 2 seconds and up to 120 a run. Send now doesn't wait for it |
| 21:00 prod, 21:10 preprod | purge | The automatic lead cleanup rules, then Lead retention if switched on, then Data retention |
| 21:30 | backup | Backs up both databases and uploaded files, locally and to Google Drive |

21:00 UTC is 2:30 in the morning in India.

## Running a job now

As the deploy user in `/srv/jobtiva`: `./cron-run.sh prod purge`, or `sync`, `ai` or `broadcasts`, and `preprod` for the other environment. Output goes to `logs/cron.log`.

## If a job seems not to run

Check `logs/cron.log` first. The crontab lives in `crontab.txt` in the deploy kit and is installed with `crontab /srv/jobtiva/crontab.txt`. After changing it, install it again.
