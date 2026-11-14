---
title: Checking whether an email reached someone (Sent emails)
category: Users and support
summary: Admin Monitoring → Sent emails lists every email the app handed to Amazon SES or SMTP, sent or failed, with the reason for a failure. It keeps no email content, and rows go after 30 days by default (Settings → Data retention).
keywords: sent emails, email log, outgoing email, didn't get the email, never received, verification email missing, reset email, bounce, failed email, delivery, message id
---

When a user says the confirmation or password reset email never came, start at **Monitoring → Sent emails**. Search for their address and you'll see every email the app tried to send them, newest first.

Each row shows when it went out, who to, which email it was, the channel (Amazon SES or SMTP) and whether it was **Sent** or **Failed**. **View details** in the Action column adds the subject line, the channel's message ID and, for a failure, what the channel said.

## Reading the result

**Sent** means the channel accepted the email. It doesn't prove it landed in the inbox: it can still bounce later or go to spam. If a user can't find a sent email, ask them to check spam first. With Amazon SES you can look the message ID up in the AWS console.

**Failed** means the channel refused it, and the error says why. Two common ones:

- While Amazon SES is in the sandbox, it only sends to addresses verified in SES. Every other address fails.
- A wrong SMTP password or host makes every email fail until Settings → Email delivery is fixed.

A broadcast email that fails is retried a few times, and each try gets its own row.

## What isn't listed

- Emails that never reached a channel. When email isn't set up at all, nothing is handed over, so there's no row. Needs attention on the dashboard flags that case.
- On a development machine, emails to test addresses (like ones ending in `.test`) are skipped before sending, so they don't appear either.
- The email itself. Only the address, which email, the subject line, the channel and the result are kept.

## Kinds of email

| Kind | What it covers |
|---|---|
| Automatic email | Everything in Engagement → Email templates, such as Confirm your email or Payment received |
| Broadcast | A message to everyone, labeled with the broadcast's title |
| Test email | The SMTP and Amazon SES tests in Settings, the template editor's test, and Send test on a broadcast |

A row is linked to the account the address belonged to when it was sent, and **View user** opens that account. When an account is deleted, its rows go with it.

## On the dashboard

The **Email delivery** block counts sent and failed emails for the period picked at the top, with a line per channel when more than one was used. Each number opens this page with the same dates and filter. These counts include admins and tests, because they measure delivery, not customers.

## How long rows are kept

30 days by default. Change it in Settings → Data retention, under **Sent emails** (7 to 365 days). The Privacy Policy states the same period, read from that setting.
