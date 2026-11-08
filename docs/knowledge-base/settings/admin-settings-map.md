---
title: Where each admin setting lives
category: Settings and data
summary: Admin Settings has sections for Profile, Password, General, Billing, Payments, Email / SMTP, Email intake, AI, Cron & schedule, Security and Data retention. This lists what each one holds.
keywords: admin settings, where is, branding, app name, logo, smtp, quiet hours, sign up, maintenance, billing, gst, gstin, pan, payments, razorpay, sections
---

| Section | What's there |
|---|---|
| Profile and Password | The signed-in admin's own details |
| General | App name, support email, tagline and whether to show it, logo, favicon, **Allow self sign-up**, **Maintenance mode** |
| Billing | **GST registered: Yes or No**, then the business details for that choice. Yes asks for business name and address, GSTIN, SAC code, GST rate and whether plan prices include GST. No asks for business name and address and PAN, and no GST is charged. Both need an invoice number prefix. The business name and address are also shown publicly, next to the support email, in the homepage Contact section and the Contact parts of Terms, Privacy and the Refund policy. A **Ready** or **Incomplete** badge shows whether it's all there. Until it's complete, online payment stays off and users request plans through support |
| Payments | Each payment gateway (Razorpay for now): on or off, test or live, key ID, key secret, webhook secret, the webhook URL to copy into Razorpay, and **Test connection**. Users pay online only while a gateway is on and Billing is complete |
| Email / SMTP | The mail server every email goes through, with **Send a test email** |
| Email intake | Forwarding on or off for everyone, the maximum email size, the AI job cap, and the Connect Gmail switch |
| AI | The admin AI provider, model and key, used only by admin-side AI such as the knowledge base agent, plus default prompts for summaries, drafts and fit scores |
| Cron & schedule | Quiet hours for background Gmail syncs, and Lead retention |
| Security | Password rules, how long a sign-in lasts, and Google reCAPTCHA |
| Data retention | How many days each kind of log is kept |

Each section has its own address, like `/jmp-admin/settings?section=retention`.

Settings that are per user, such as follow-up timing, cleanup rules and AI keys, are in each user's own Settings, not here.
