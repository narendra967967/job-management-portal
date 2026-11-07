---
title: How plans work and what each plan switch controls
category: Plans and billing
summary: Plans are set up in admin Sales → Plans & pricing. Each has prices, limits and feature switches. One free plan is the default for new sign-ups, and a feature that's off shows as locked to the user.
keywords: plans, pricing, free plan, default plan, features, plan switches, locked, upgrade, pricing page, paid plan
---

Plans live in admin **Sales → Plans & pricing**. Each plan has a name, an internal code (made from the name and fixed once saved), a description, a header color, prices, limits and feature switches.

## Free and paid plans

- A **free plan** has no prices. Its **Free access duration (days)** sets how long a new user gets, and 0 means it never expires. Exactly one free plan is active at a time.
- One free plan is the **default for new sign-ups**. Registration only opens while a default plan exists.
- A **paid plan** has a monthly price, a yearly price or both. Setting a price to 0 turns that billing period off, but at least one must be above 0.
- **Show on the public pricing page (when active)** puts the plan on `/pricing`, which reads everything straight from the plan as stored.

A plan someone is on can't be deactivated, the default plan can't be deleted, and a plan anyone has ever been on can't be deleted, only deactivated.

## Feature switches

| Switch | Turns on |
|---|---|
| Allow custom AI prompts on this plan | Users can write their own AI prompts in Settings → AI prompts |
| Notes (personal notepad) | The notes panel in the top bar |
| AI salary insight on jobs | **Estimate my salary** on a lead |
| Résumé ATS score check | The ATS check on each résumé |
| AI outreach drafts | AI-written outreach messages |
| AI reads alerts from sites without a built-in reader | AI reading of forwarded alerts |
| Priority support | Marks the plan for priority support |

Every AI feature also needs the user's own AI key. The plan decides whether a feature is allowed, and the key pays for it.

When a feature is off, users see it locked with "On higher plans" or "isn't on your plan". Messages never name a plan, because plan names can change in admin.

## Payments

There's no self-serve checkout yet. The user's **Upgrade your plan** button, shown only when a higher-priced plan exists, opens a support request instead. An admin then changes their plan in Users. The Billing section in admin Settings holds payment provider and tax details for when checkout is built.
