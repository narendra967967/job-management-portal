---
title: Password rules, sign-in length, reCAPTCHA and the mail server
category: Settings and data
summary: Admin Settings → Security sets the password policy, how long a sign-in lasts and reCAPTCHA. Email delivery picks the service every email goes through. Without one set up, no verification, reset or notification email sends.
keywords: password policy, session length, stay signed in, sign in last, how long signed in, logged out, recaptcha, smtp, email not sending, test email, security settings
---

## Security

- **Password rules:** a minimum length (8 by default), plus whether to require an uppercase letter, a lowercase letter, a number and a special character. They apply to every new password in the app, including sign-up and resets.
- **Stay signed in for:** how long a sign-in lasts, in hours or days, 7 days by default. A change applies to new sign-ins after the app restarts.
- **Google reCAPTCHA:** an invisible check on sign-in, sign-up and password pages, admin sign-in included. Saving it switched on runs a live test first and only saves if Google accepts the keys. It fails closed, so if it breaks, nobody can sign in. See the reCAPTCHA lockout runbook.

## Email delivery

Every email the app sends, from verification links and password resets to ticket transcripts and cleanup notices, goes through the service chosen here: SMTP or Amazon SES. Passwords and keys are stored encrypted, and each tab has its own test email. The email delivery article covers SES, switching and what to do when sending fails.

If emails aren't arriving, test here first. In development, emails to test addresses such as `.test` or `.localhost` are never sent; the link or code is written to the server log instead.
