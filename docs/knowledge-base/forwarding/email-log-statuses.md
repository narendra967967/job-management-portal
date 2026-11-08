---
title: What each Email log status means and how to fix it
category: Email forwarding
summary: The user's Email log shows each email as Accepted, Already received, No jobs found, Reading with AI, Rejected, Paused or Gmail confirmation, with the reason underneath and a one-tap fix where there is one.
keywords: email log, rejected, not from a supported site, we don't accept alerts from this site yet, no jobs found, ask us to add it, add your ai key, forward again, already received, paused, plan ended, alerts stopped
---

Every email that reaches a user's address gets a row in **Settings → Email log**, with a status and a plain-English reason. Rows stay for the inbound log period in admin Data retention, 30 days by default.

| Status | What it means |
|---|---|
| Accepted | It worked. The reason line says how many jobs were new, and "renewed" ones were already there |
| Already received | The same email came in before, so nothing was done |
| No jobs found | Jobtiva couldn't read jobs from it. The line underneath says why |
| Reading with AI | AI is still working on it |
| Rejected | It didn't pass our checks. The line underneath says why |
| Paused | It arrived while their plan had ended (or the account was deactivated), so it wasn't read. Nothing is kept to read later; once they're on a plan again, new alerts are read as usual, and they can forward an old one by hand |
| Gmail confirmation | Gmail's forwarding confirmation, shown in Settings → Email forwarding |

## Rejected

| Reason the user sees | Fix |
|---|---|
| We don't accept alerts from this site yet | **Ask us to add it** opens a support ticket, category Job site request, with the site filled in |
| Hand-forwarded from a site we don't accept yet | Same as above |
| Couldn't confirm it really came from the job site | Let the Gmail filter forward the alert as it arrived, or add the job by hand |
| Hand-forwarded · original sender not found | Forward the original alert, not a forward of a forward |
| The email was too large, or couldn't be read | Add the job by hand |
| Forwarding turned off | The user switched forwarding off in Settings → Email forwarding |

## No jobs found

These rows show the one step that would get the email read, based on the user's plan and key as they are now, not when it arrived:

| What the row says | Meaning |
|---|---|
| Link: **See your plan** | AI could read it, but AI email reading isn't on their plan |
| Link: **Add your AI key** | Their plan covers it, but there's no key |
| "AI can read this now, but only if it comes in again" | Plan and key are in place. Old emails aren't re-read, so they forward it by hand from Gmail |
| Your AI provider rejected your key, or is out of credit | They fix the key in Settings → AI provider, then forward the alert again |
| AI found no jobs | Nothing to turn into a lead. They add the job by hand if there was one |

Once someone forwards an old alert by hand, the result shows as a new row. The old row keeps its message, because the two can't be matched up.

## Ingestion issues

**Settings → Ingestion issues** separately lists alerts that couldn't be turned into leads, with a **Report to support** button that sends us the details.
