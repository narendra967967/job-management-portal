---
title: How job alert forwarding works
category: Email forwarding
summary: Each user gets a private forwarding address. A Gmail filter sends their job alerts there, and Jobtiva turns each accepted alert into leads. Every email that arrives is listed in the user's Email log.
keywords: forwarding address, gmail filter, private address, confirm forwarding, reset address, email log, how leads arrive
---

Each user gets a private address on our mail domain. They set up a Gmail filter that forwards job alerts to it, and every alert that passes our checks becomes leads. Nobody gives us access to their mailbox. The original email stays in their inbox.

## Setting it up

The user does this in **Settings → Email forwarding**:

1. Copy their private address.
2. Add it as a forwarding address in Gmail. Gmail sends a confirmation email to that address, and we catch it: the user sees a **Confirm forwarding** button, plus Gmail's own email, so they can confirm without leaving Jobtiva.
3. Create a filter with **Create a filter for job alerts**. **Copy filter text** gives them the From text listing every job site we accept, so the filter only forwards alerts.

The filter's From text only covers sites we accepted when they copied it. When we add a site, users need to copy the new text into their filter.

## What happens to each email

Every email is checked in order: the address must be theirs, the email must be under the size limit (2 MB by default), and it must come from an allowed sender and be signed by that sender's domain. Gmail's own forwarding seal counts too, for the many alerts Gmail re-signs when it forwards them. The same email arriving twice is only read once.

An accepted alert is read by the site's built-in reader, or by AI when the site has none and the user's plan and key allow it. Each job becomes a lead. If the job is already there, it's refreshed and tagged "Re-newed" instead of added twice. New leads appear within about a minute and a half, or right away on reload.

## Where to look when something's missing

**Settings → Email log** lists every email that arrived, what happened to it and why, with the fix when there is one. If an alert isn't in the log at all, it never reached us, so the problem is on the Gmail side: the filter, or an old address. See the article on Email log statuses.

## Resetting the address

**Reset address** issues a new address right away and stops the old one working. The user then has to add the new address in Gmail and update their filter. They do this if the old address leaks.
