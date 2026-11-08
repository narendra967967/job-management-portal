---
title: What happens when a user's plan expires
category: Plans and billing
summary: When a plan's expiry passes, the user can still sign in but the app goes into limited mode. Everything is locked except Upgrade Plan, Help & support, guides and Settings (Help and Account only), until they buy a plan or an admin renews it.
keywords: plan expired, renew, renewal page, expiry, access days, free trial, extend plan, limited mode, locked menus, upgrade plan
---

Every user has a plan and, usually, an expiry date. New users start on the default free plan, and their expiry is set from its **Free access duration (days)**. 0 means it never expires, and admin Users shows that as "Never". Changing a user's plan resets the expiry from the new plan.

The free trial is once only. Users can't pick a free plan for themselves, so after the trial the only ways forward are paying for a plan or an admin extending it in Users.

## Limited mode

The day the expiry passes, the user can still sign in, but every menu except **Upgrade Plan** is locked. The lock isn't just the menu: opening a locked page by its address sends them back to Upgrade Plan, and actions like adding a lead or using AI are refused on the server.

What stays open:

- **Upgrade Plan**, which lists every paid plan
- Help & support and the guides
- Settings, showing only the Help and Account tabs

The Upgrade Plan page is headed "Your plan has ended" and tells them their leads, contacts and settings are safe. Nothing is deleted while a user is in limited mode.

## Getting them back in

If online payment is on (see "How online plan payments work"), the user picks a plan and pays, and the menus open again as soon as the payment is confirmed. If it's off, each plan offers **Request this plan**, which opens a support ticket. You then renew or switch their plan in admin **Users**, by renewing for a number of days (30 by default) or picking another plan.

The old /renew address still works and forwards to Upgrade Plan.

## Deactivated is different

An admin can also deactivate a user. Deactivated users don't get limited mode. They see a separate page explaining it, with a way to ask an admin to reactivate them, which arrives as a support ticket.
