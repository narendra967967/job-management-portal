---
title: How accounts are created, verified and blocked
category: Users and support
summary: Users sign up themselves only while Allow self sign-up is on and a default plan exists; otherwise admins create them. Every account must confirm its email before signing in. Admins can deactivate users, and maintenance mode blocks everyone.
keywords: sign up, signup, register, verify email, verification link, deactivated, maintenance mode, create user, password policy, cannot sign in
---

## Who can sign up

Self sign-up works only while **Allow self sign-up** is on in admin Settings → General **and** a default plan exists. If either is missing, the sign-up page and buttons disappear and `/signup` sends people to sign in. Admins can always create users in admin **Users**, as long as a default plan exists.

New users get the default plan, with an expiry from its access days. Sign-up is limited to 5 attempts an hour from one address, and passwords must meet the password policy in admin Settings → Security.

## Verifying the email

No account can sign in until its email is verified, and how that happens depends on who created it.

- **Self sign-up:** we email a confirmation link right away. It works for 24 hours, and clicking it verifies the account, signs the user in and opens Leads.
- **Created by an admin:** the user gets a welcome email with a **Set your password** link instead. Setting a password through it verifies them. If the admin typed a password for them, their first sign-in sends a confirmation link.

Anyone who lost or let a link run out only has to sign in again. With the right password, they're told their email isn't confirmed and a fresh link goes out, at most one every few minutes. Setting a new password through **Forgot password** verifies them too, since that link also proves they own the address.

Admin **Users** marks anyone still unconfirmed with *not verified* next to their email. If the email never arrives, check admin Settings → Email delivery first, since nothing sends without it.

## When a user can't get in

| What they see | Cause |
|---|---|
| Your email isn't confirmed yet | They haven't used their link. That sign-in just sent a new one |
| Everything locked except Upgrade Plan ("Your plan has ended") | Their plan's expiry passed, so they're in limited mode. They can buy a plan there, or you renew it in admin Users |
| A deactivated notice | An admin deactivated them. They can ask to be reactivated from that page |
| The maintenance page | Maintenance mode is on in admin Settings → General, which blocks every user |
| A security check error | reCAPTCHA is failing. See the reCAPTCHA lockout runbook |

Signing in has its own limit of 5 attempts a minute from one address.
