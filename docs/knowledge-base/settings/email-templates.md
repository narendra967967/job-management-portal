---
title: Changing the wording of automatic emails (email templates)
category: Settings and data
summary: Engagement → Email templates holds the wording of all 15 emails the app sends on its own. Edit the subject, heading, message, button label and footer, using placeholders like {{user_name}}. The next email sent uses it.
keywords: email template, email wording, edit email text, password reset email text, welcome email text, receipt wording, placeholder, merge tag, variables, change subject line, automatic emails
---

Every email the app sends by itself lives under **Engagement → Email templates**: sign-in emails, confirmation codes, account notices, plan reminders, payment receipts, the old-leads cleanup notice, support replies and the reactivation request that comes to your own support inbox. There are 15, in six groups. Whatever you save there is what the next email uses. There's no publish step.

Two kinds of email aren't here. Broadcasts are written each time you send one, and the two test emails in Settings → Email delivery (SMTP and Amazon SES) are fixed.

## What you can change

Open an email from the list and you get five fields: **Subject**, **Heading** (the large title, can be empty), **Message**, **Button label** and **Footer note** (a small line above the footer, can be empty). The button label only appears for emails that have a button.

Links can't be edited, and that's deliberate. The reset link, the confirmation link and the plan page link are made by the app for each person and always sit behind the button, so a typo in the wording can never break them.

The frame around every email stays the same: the app name across the top, then your support email and the copyright line at the bottom. Those come from **Settings → General**.

## Placeholders

The parts that change per person are placeholders in double braces, like `{{user_name}}` or `{{ticket_number}}`. Each email lists its own on the right, with what each one becomes. Click in a field first, then click a placeholder and it drops in where the cursor is.

A few things to know:
- `{{user_name}}` is the person's first name, or "there" when we don't have one, so "Hi {{user_name}}" always reads naturally.
- Placeholders marked with a star are required. The code emails can't be saved without `{{code}}`, the receipt needs `{{receipt_details}}` and the resolved-ticket email needs `{{conversation}}`.
- Dashed placeholders are whole blocks the app builds, such as the receipt table or the ticket conversation. They can only go in the message.
- "Your plan ends soon" has two blocks the app writes for you, `{{leads_line}}` and `{{upgrade_line}}`, because those sentences depend on whether it's a trial, how many leads the person has and whether there's a bigger plan to suggest. The button text there is a placeholder too, for the same reason. Everything around them is yours.
- Values go in as plain text. A user who puts HTML in their name just gets odd-looking text, never formatting.

Saving is refused, with the reason under the field, if a placeholder doesn't exist in that email, a required one is missing, a block is outside the message, or a field is too long. The limits are 150 characters for the subject and heading, 40 for the button label, 300 for the footer and 20,000 for the message.

The message editor is the same one How-to guides use. Images need a full web address (https://…) to show in email. Anything unsafe, like scripts, is stripped when you save.

## Checking before you rely on it

**Preview** shows the email in the branded layout with sample values filled in. **Test to me** emails it to your own admin address with "[Test]" in the subject, using the wording on screen even if you haven't saved it. It needs email set up in **Settings → Email delivery**. Send yourself a test after any real change. A preview can't show you how Gmail or Outlook will treat it.

## History and going back

Each save keeps the wording it replaced under **Earlier versions**, up to the 5 newest. **View** shows one and **Restore** puts it back, and the wording you had becomes a version itself. The first time an email is edited, its built-in wording is kept there as **Built-in default**.

**Reset to default** brings back the built-in wording, from the email's page or for several emails at once from the list. The edited wording goes into history, so a reset can be undone with Restore.

The list's **Edited** and **Using the default** boxes count and filter the emails. Saving wording that matches the built-in text exactly counts as using the default, and it keeps getting any improvements made to the built-in wording later.

## If an edited email stops working

When an update to the app changes an email's placeholders, saved wording that uses one that's gone, or lacks a newly required one, can't be filled in properly. The app doesn't send a broken email in that case. It sends the built-in wording instead, with a warning line starting `[email-templates] saved wording for` in the app's output. Open that email, fix what the editor flags and save.

## Adding a new automatic email (for developers)

Any email the app sends on its own has to be listed here so admins control its wording. Add it to the registry in `lib/email-templates-model.ts` (its key, placeholders and default wording) and send it with `sendTemplateEmail()` from `lib/email-templates.ts`. Don't put the wording in the sender. `scripts/security/email-templates-checks.mts` fails if a registered email has no sender or a sender bypasses the templates.
