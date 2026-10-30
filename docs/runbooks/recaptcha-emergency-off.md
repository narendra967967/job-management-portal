# Runbook — turn reCAPTCHA off when nobody can sign in

**When to use:** Google reCAPTCHA is on (admin Settings → Security) and sign-in
fails for everyone — including admin — with "We couldn't run the security check
right now" or "Our security check couldn't confirm you're human". Typical causes:
Google is down, the reCAPTCHA key was deleted, a domain was removed from the key,
or the secret was rotated in Google's console.

**Decision (owner, 2026-10-25):** no automatic bypass. reCAPTCHA fails closed on
every page, admin login included. Recovery is this server switch.

## First, check if an admin is still signed in

Sign-in is the only thing reCAPTCHA guards; existing sessions keep working.
If any admin is still signed in: **admin Settings → Security → Google reCAPTCHA →
untick → Save.** It switches off immediately. Stop here.

## Otherwise — the server switch

`RECAPTCHA_FORCE_OFF=true` in the app's env file makes the app ignore the
reCAPTCHA setting entirely (lib/captcha.ts). Do one environment at a time.

1. **Connect to the server** (EC2 `jobtiva`) the usual way.

2. **Become the deploy user** — it owns the app folder.
   ```bash
   sudo -iu deploy
   ```

3. **Go to the app folder.**
   ```bash
   cd /srv/jobtiva
   ```

4. **Add the switch** to the affected environment's env file
   (`env/prod.env` for prod, `env/preprod.env` for preprod).
   ```bash
   echo 'RECAPTCHA_FORCE_OFF=true' >> env/prod.env
   ```
   Plain words: a note to the app saying "ignore the reCAPTCHA setting".

5. **Recreate that app container** so it reads the new env
   (`app-prod` or `app-preprod`). `docker compose restart` does NOT reload env
   files — use `up -d`.
   ```bash
   docker compose up -d --no-deps app-prod
   ```

6. **Sign in as admin** and open Settings → Security. A yellow note says the
   check is turned off on the server. Fix the keys (or untick reCAPTCHA).
   Saving with the box checked runs a live test first — it only saves if Google
   accepts the keys.

7. **Remove the switch** and recreate the container again, so the admin setting
   is back in charge.
   ```bash
   sed -i '/^RECAPTCHA_FORCE_OFF=/d' env/prod.env
   docker compose up -d --no-deps app-prod
   ```

8. **Check:** sign out, sign in again on the login page — it should work with
   reCAPTCHA on.

## Notes

- Local development: put `RECAPTCHA_FORCE_OFF="true"` in `.env.local` and
  restart `npm run dev`.
- The switch is documented in `deploy/vps/app.env.example` and `.env.local.example`.
