---
title: Where each admin setting lives
category: Settings and data
summary: Admin Settings has sections for Profile, Password, General, Billing, Email / SMTP, Email intake, AI, Cron & schedule, Security and Data retention. This lists what each one holds.
keywords: admin settings, where is, branding, app name, logo, smtp, quiet hours, sign up, maintenance, billing, sections
---

| Section | What's there |
|---|---|
| Profile and Password | The signed-in admin's own details |
| General | App name, support email, tagline and whether to show it, logo, favicon, **Allow self sign-up**, **Maintenance mode** |
| Billing | Payment provider, mode, currency, keys, tax and invoice details. Saved for when checkout is built; nothing charges yet |
| Email / SMTP | The mail server every email goes through, with **Send a test email** |
| Email intake | Forwarding on or off for everyone, the maximum email size, the AI job cap, and the Connect Gmail switch |
| AI | The admin AI provider, model and key, used only by admin-side AI such as the knowledge base agent, plus default prompts for summaries, drafts and fit scores |
| Cron & schedule | Quiet hours for background Gmail syncs, and Lead retention |
| Security | Password rules, how long a sign-in lasts, and Google reCAPTCHA |
| Data retention | How many days each kind of log is kept |

Each section has its own address, like `/jmp-admin/settings?section=retention`.

Settings that are per user, such as follow-up timing, cleanup rules and AI keys, are in each user's own Settings, not here.
