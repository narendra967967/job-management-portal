---
title: The scheduled jobs on the server and what each one does
category: Runbooks
summary: The server crontab runs the AI alert reader and broadcast sender every 5 minutes, Gmail sync every 15, and daily the renewal reminders, cleanup and backup. The dashboard System block shows each job's last run.
keywords: cron, crontab, scheduled jobs, daily job, sync, purge, backup, broadcasts, scheduled broadcast, cron secret, quiet hours, run now, reminders, job failed, job late, last run, system block
---

Scheduled work runs from the `deploy` user's crontab on the server, for prod and preprod each. The server clock is UTC. Each job calls a route in the app with that environment's secret, and the route refuses anything without it.

| Schedule (UTC) | Job | What it does |
|---|---|---|
| Every 15 minutes | sync | Gmail sync, for users connected that way. Each user is synced on their own interval, and nothing runs during quiet hours |
| Every 5 minutes | ai | Picks up alerts waiting for the AI reader, including retries |
| Every 5 minutes (prod at :02, :07…, preprod at :04, :09…) | broadcasts | Starts scheduled broadcasts that are due and sends queued broadcast emails, one every 2 seconds and up to 120 a run. Send now doesn't wait for it |
| 04:30 prod, 04:40 preprod | reminders | Emails renewal reminders to people whose plan ends within 7 days, once a day each |
| 21:00 prod, 21:10 preprod | purge | The automatic lead cleanup rules, then Lead retention if switched on, then Data retention |
| 21:30 | backup | Backs up both databases and uploaded files, locally and to Google Drive |

04:30 UTC is 10:00 in the morning in India, and 21:00 UTC is 2:30 at night.

## Running a job now

As the deploy user in `/srv/jobtiva`: `./cron-run.sh prod purge`, or `sync`, `ai`, `broadcasts` or `reminders`, and `preprod` for the other environment. Output goes to `logs/cron.log`.

## Did the jobs run?

Look at the System block on the admin dashboard first. It lists the app's jobs with when each last finished and how it went: **AI alert reader** (ai), **Broadcast sender** (broadcasts), **Gmail sync** (sync), **Renewal reminders** (reminders) and **Daily cleanup** (purge, which covers the lead rules, Lead retention and Data retention in one run). The backup isn't an app job, so it isn't listed; its log is `logs/backup.log`.

| Shown | Meaning |
|---|---|
| OK | The last run finished |
| Failed | The last run stopped with an error. The error is shown under the job, with how many runs in a row have failed |
| Late | No run for 30 minutes (5-minute jobs), an hour (Gmail sync) or 26 hours (daily jobs) |
| Not run | No run recorded in this environment yet |

Failed only covers a run that stopped. A job that works through a problem itself, like one user's Gmail sync failing or one broadcast email bouncing, still shows OK; those show up in Gmail health, Sent emails and the broadcast. Late means a job that used to run has stopped: usually the crontab was changed or removed, or the app was down when the job was due. A crontab that was never installed shows every job as Not run instead.

Failed and Late jobs also appear at the top of the dashboard under **Needs attention**, failed ones as urgent. Not run jobs don't, so on a new server check the System block yourself after the first hour.

A run started with `cron-run.sh` by hand counts like any other. **Send now** on a broadcast doesn't, because it isn't the scheduled job.

## If a job seems not to run

Check `logs/cron.log` first. The crontab lives in `crontab.txt` in the deploy kit and is installed with `crontab /srv/jobtiva/crontab.txt`. After changing it, install it again.
