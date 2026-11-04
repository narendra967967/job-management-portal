---
title: Switching forwarding or the Gmail connection on and off
category: Email forwarding
summary: Admin Settings → Email intake turns forwarding on or off for everyone and sets the size limit and AI job cap. Each user can also turn their own forwarding off. Connect Gmail is a separate admin switch.
keywords: email intake, forwarding switch, disable forwarding, connect gmail, gmail oauth, max size, temporarily unavailable
---

## For everyone: admin Settings → Email intake

| Setting | What it does |
|---|---|
| Forwarding on or off | Off answers incoming mail with "Forwarding is temporarily unavailable", so the sending server holds it and tries again later. Nothing is lost while it's briefly off |
| Maximum email size | 2 MB by default. Larger emails are rejected as too large |
| AI job cap | The most jobs AI keeps from one email, 20 by default, from 1 to 100 |

## For one user: Settings → Email forwarding

**Disable forwarding** stops everything for that user, Gmail's confirmation email included. Emails are logged as rejected with "Forwarding turned off". Those emails aren't marked as seen, so the user can still forward them by hand once it's back on.

## Connect Gmail

The older way in, where a user links their Gmail for read-only access and we search it on a schedule, has its own switch, also in admin Settings → Email intake. Turning it off asks for confirmation first. While it's on, users see the Gmail and sync schedule settings. Turning it off hides those tabs, stops the syncs, blocks new links, and revokes and deletes every stored Google connection. Users reconnect if it's turned back on. Gmail access is always read-only.
