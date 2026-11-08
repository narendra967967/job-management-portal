---
title: Sending a message to every user (broadcasts)
category: Users and support
summary: Engagement → Broadcasts sends one message to every user, in the app, by email or both, now or later. Important ones reach everyone; Promotional ones skip anyone who opted out, and every promotional email has a one-click unsubscribe.
keywords: broadcast, announcement, newsletter, notify all users, email all users, promotional, important, unsubscribe, opt out, scheduled message, mass email
---

Broadcasts live under **Engagement → Broadcasts**. Start one with **New broadcast**.

## Writing it

- **Title** shows in the bell and is the email subject, so write it as something people would open.
- **Category** decides who gets it. **Important** goes to every user whose account isn't deactivated, on any plan, and nobody can opt out. **Promotional** goes to the same people minus anyone who turned promotional messages off.
- **Send it** picks the channel: **In the app**, **Email** or **Both**.
- **Message** uses the same editor as How-to guides. Images need a full web address (https://…) or they won't show in email, and embedded videos arrive in email as a "Watch the video" link.

Keep Important for things that genuinely affect accounts, like downtime or a policy change. People can't turn those off, and using them for offers is how a domain ends up in spam folders.

The **Who gets it** box counts the audience live. It also says who misses part of it:
- users on an expired plan see the in-app copy only after they renew;
- users who haven't confirmed their email get no email;
- deactivated accounts get nothing.

**Preview** shows the bell entry, the opened message and the email. **Test to me** emails it to your own admin address with "[Test]" in the subject. Use it before anything goes to everyone.

## Sending or scheduling

**Send now** starts within seconds. **Schedule** takes a date and time in your browser's time zone, at least 10 minutes ahead, and it goes out within about 5 minutes of that time. The confirmation shows the exact counts before anything happens.

Once it starts:
- in-app copies land for everyone at once;
- emails go one every 2 seconds, up to 120 a run, and the server's job carries on every 5 minutes until the list is done. Sending is slow on purpose, because the app sends through a mailbox that blocks bursts;
- no more than 1,000 broadcast emails go out in 24 hours. The rest wait and continue later;
- a failed email is tried again after 5 minutes and marked failed after 3 tries.

The broadcast's page shows sent, failed and skipped counts as they change. **Stop sending** cancels the emails still waiting; sent ones and in-app copies stay.

A broadcast can be edited or canceled until it starts. After that it's a record of what went out. **Duplicate** makes a new draft from it, and only drafts and sends canceled before they started can be deleted.

## Unsubscribing

Users turn promotional messages off in **Settings → Notifications**. Every promotional email also has an unsubscribe link at the bottom that works in one click without signing in, and mail apps like Gmail show their own Unsubscribe button for it. Important emails have neither.

## Testing on a developer's machine

On a developer's machine only test addresses (ending in .test, .localhost and the like) are emailed. Real addresses are skipped, and the broadcast's page says why.

Scheduled sends depend on the broadcasts job in the server's crontab. If a scheduled broadcast never starts, check that job first (see the scheduled jobs runbook).

## How long records are kept

The list of who each email went to, and whether it arrived, is deleted after 90 days by default, set in **Settings → Data retention** as Broadcast email lists. The totals on the broadcast stay. The in-app copies are notifications, so they follow the Notifications period.
