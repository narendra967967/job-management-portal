---
title: When AI reads a job alert
category: Email forwarding
summary: AI reads an alert only when the site has no built-in reader, or the reader found no jobs, and the user's plan includes AI email reading and they've added an AI key. It runs on the user's own key, in the background.
keywords: ai read, read alert, ai reads alerts, ai email reading, reading with ai, ai reader failed, ai found no jobs, out of credit, job cap
---

AI steps in only when the built-in route can't: the site has no reader, or its reader found no jobs in the email. Even then, two things must be true:

- The user's plan has **AI reads alerts from sites without a built-in reader** switched on.
- The user has added **their own AI key**. It always runs on their key, never ours.

If either is missing, the email is logged as No jobs found, and the Email log shows what to add.

## How it runs

The email is reduced to its text and a numbered list of its links, and queued. The row shows **Reading with AI** until it finishes, usually within moments. A sweep every 5 minutes picks up anything left over. Failed reads are retried up to 3 times, and the queue gives up after 24 hours.

AI picks out jobs and points to them by link number. A job is only kept if its link really appears in the email, so a made-up job can't slip through. Each email is capped at a number of jobs, 20 by default, set in admin Settings → Email intake.

## How it can end

| Result | What the user sees |
|---|---|
| Jobs found | Accepted, with "AI found N, kept M" |
| Nothing usable | AI found no jobs |
| Key rejected | Your AI provider rejected your key |
| No credit (provider said 402) | Your AI provider is out of credit |
| Failed after retries | AI couldn't read this email |

A rejected key or no credit stops right away instead of retrying, since retrying won't fix it. After fixing the key, the user forwards the alert again by hand.
