---
title: Nobody can sign in because of reCAPTCHA
category: Runbooks
summary: If an admin is still signed in, untick reCAPTCHA in Settings → Security. If nobody is, turn it off on the server with RECAPTCHA_FORCE_OFF=true.
keywords: captcha, recaptcha, login, sign in, locked out, security check
---

When reCAPTCHA is on and sign-in fails for everyone, admins included, people see "We couldn't run the security check right now" or "Our security check couldn't confirm you're human". The usual causes are Google being down, the key being deleted, a domain removed from the key, or the secret rotated in Google's console.

There's no automatic bypass. That was a deliberate choice, so the check fails closed on every page, admin sign-in too.

## Check for a signed-in admin first

reCAPTCHA only guards sign-in. Anyone already signed in stays signed in. If an admin still has a session, go to **Settings → Security → Google reCAPTCHA**, untick it and save. It's off straight away, and you can stop here.

## If nobody can get in

Use the server switch. `RECAPTCHA_FORCE_OFF=true` makes the app ignore the reCAPTCHA setting completely. Do one environment at a time.

1. Connect to the server and become the deploy user with `sudo -iu deploy`, then `cd /srv/jobtiva`.
2. Add the switch to the affected environment's env file, `env/prod.env` or `env/preprod.env`:
   `echo 'RECAPTCHA_FORCE_OFF=true' >> env/prod.env`
3. Recreate that app container so it reads the file: `docker compose up -d --no-deps app-prod`. A plain `docker compose restart` doesn't reload env files, which catches people out.
4. Sign in as admin. Settings → Security now shows a note that the check is turned off on the server. Fix the keys, or untick reCAPTCHA. Saving with it ticked runs a live test first and only saves if Google accepts the keys.
5. Take the switch out and recreate the container again, so the admin setting is back in charge:
   `sed -i '/^RECAPTCHA_FORCE_OFF=/d' env/prod.env`, then `docker compose up -d --no-deps app-prod`.
6. Sign out and back in to check it works with reCAPTCHA on.

For local development, put `RECAPTCHA_FORCE_OFF="true"` in `.env.local` and restart `npm run dev`.
