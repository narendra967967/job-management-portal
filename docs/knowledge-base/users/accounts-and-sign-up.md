---
title: How accounts are created, verified and blocked
category: Users and support
summary: Users sign up themselves only while Allow self sign-up is on and a default plan exists; otherwise admins create them. New users must verify their email before signing in. Admins can deactivate users, and maintenance mode blocks everyone.
keywords: sign up, signup, register, verify email, verification link, deactivated, maintenance mode, create user, password policy, cannot sign in
---

## Who can sign up

Self sign-up works only while **Allow self sign-up** is on in admin Settings → General **and** a default plan exists. If either is missing, the sign-up page and buttons disappear and `/signup` sends people to sign in. Admins can always create users in admin **Users**, as long as a default plan exists.

New users get the default plan, with an expiry from its access days. Sign-up is limited to 5 attempts an hour from one address, and passwords must meet the password policy in admin Settings → Security.

## Verifying the email

A new account can't sign in until its email is verified. We send a link that's valid for an hour, and clicking it verifies the account, signs the user in and opens Leads. If the email never arrives, check admin Settings → Email / SMTP first, since nothing sends without it.

## When a user can't get in

| What they see | Cause |
|---|---|
| Asked to verify their email | They haven't clicked the link yet |
| Your plan has expired | Their plan's expiry passed. Renew it in admin Users |
| A deactivated notice | An admin deactivated them. They can ask to be reactivated from that page |
| The maintenance page | Maintenance mode is on in admin Settings → General, which blocks every user |
| A security check error | reCAPTCHA is failing. See the reCAPTCHA lockout runbook |

Signing in has its own limit of 5 attempts a minute from one address.
