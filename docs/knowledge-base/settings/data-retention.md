---
title: How long logs and history are kept
category: Settings and data
summary: Admin Settings → Data retention sets how many days each kind of log is kept, and the daily cron job deletes anything older. Leads themselves are never removed by this.
keywords: retention, data retention, delete logs, how long, notifications, email log, processed ledger, conversations, history
---

**Admin Settings → Data retention** sets a window in days for each kind of log. The daily cron job deletes anything older. Leads themselves are never removed by this, only by the user, or by Lead retention when it's switched on.

| Type | What it is | Default | Allowed |
|---|---|---|---|
| Inbound email log | Every forwarded email, metadata only | 30 | 1 to 365 |
| Ingestion issues | Users' list of alerts that couldn't be read | 30 | 7 to 365 |
| Processed-email ledger | Stops one email being read twice | 180 | 60 to 730 |
| Lead purge history | Record of leads removed by Lead retention | 365 | 30 to 1095 |
| Notifications | The bell, read or not | 90 | 7 to 365 |
| Automatic move history | Why the system moved a lead, on its card and Timeline | 365 | 90 to 1095 |
| Knowledge base conversations | Admins' chats with the agent, from the last message | 60 | 7 to 365 |

Two have reasons behind their limits:

- **Processed-email ledger** stays at least 60 days, so an alert re-sent by a job site isn't read again as new.
- **Automatic move history** keeps moves a user undid for as long as the lead exists, because they're what stops that rule acting on the lead again.

The Privacy page states these periods, read from the same settings, so changing a window updates it automatically. Expired one-time codes are always deleted and have no setting.
