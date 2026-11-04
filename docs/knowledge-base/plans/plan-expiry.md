---
title: What happens when a user's plan expires
category: Plans and billing
summary: A new user's expiry comes from their plan's access days. When it passes, they can still sign in but only see a "Your plan has expired" page, until an admin renews or changes their plan in Users.
keywords: plan expired, renew, renewal page, expiry, access days, free trial, extend plan
---

Every user has a plan and, usually, an expiry date. New users get the default free plan, and their expiry is set from its **Free access duration (days)**. 0 means it never expires, and admin Users shows that as "Never". Changing a user's plan resets the expiry from the new plan.

## When it passes

The user can still sign in, but every dashboard page sends them to a page headed **Your plan has expired**, which says their data is safe. Its **Renew plan** button is grayed out for now, because there's no checkout yet, so the only other option is to log out.

That means an expired user can't renew themselves. An admin does it in admin **Users**, by renewing the plan for a number of days (30 by default) or switching the user to another plan. Their leads and settings are untouched while they're expired.

## Deactivated is different

An admin can also deactivate a user. Deactivated users see a separate page explaining that, with a way to ask an admin to reactivate them, which arrives as a support ticket.
