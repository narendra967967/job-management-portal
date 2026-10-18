# Domain setup & cutover runbook

How to point this app at a (new) domain, and the gotchas that will bite you if you
don't. Written from the preprod move `preprod.jmp.narendragupta.in → preprod.jobtiva.in`
(2026-10). Prod on the `jobtiva.in` apex follows the same recipe.

> The example commands below come from the old single-container AWS box (`jmp`, `sudo docker …`).
> On the current server (`VPS.md`) the containers are `app-preprod` / `app-prod`: read a value with
> `docker compose exec app-preprod printenv BETTER_AUTH_URL`, and apply an env change with
> `docker compose up -d app-preprod`, as `deploy` in `/srv/jobtiva`.

## How domains work here

There is **one** source of truth: the `BETTER_AUTH_URL` env var. It drives:

- Better Auth base URL for both instances — `lib/auth.ts` (user) and `lib/auth-admin.ts` (admin).
- The Google OAuth callback, which Better Auth derives as `${BETTER_AUTH_URL}/api/auth/callback/google` (no redirect URI is hardcoded).
- Links in outgoing email — `getAppBaseUrl()` in `lib/branding.ts`.

**No domain is hardcoded in application code.** A domain change is therefore
config/infra only: DNS → TLS → `BETTER_AUTH_URL` → Nginx → Google OAuth (+ cron `APP_URL`).

## Gotchas (each one cost us time)

1. **The box `.env` must be UNQUOTED.** It's loaded by `docker run --env-file`, which does
   *not* strip quotes — it takes the literal text after `=`. So
   `BETTER_AUTH_URL="https://host"` makes the app receive the string *with* the quotes →
   `BetterAuthError: Invalid base URL` (the whole app 500s) and/or `Invalid origin` on
   login. Correct form on the box:
   ```
   BETTER_AUTH_URL=https://preprod.jobtiva.in
   ```
   (Local `.env.local` is loaded by Next.js's own env loader, which *does* strip quotes —
   quotes are fine there, which is why the same value works quoted locally but not on the box.)

2. **`docker restart` does NOT reload `--env-file`.** Env is baked in at `docker run` time.
   After editing `.env` you must recreate the container:
   ```
   sudo docker rm -f jmp && sudo docker run -d --name jmp \
     --env-file /home/ubuntu/job-management-portal/.env \
     -p 127.0.0.1:3000:3000 --restart unless-stopped \
     504721334099.dkr.ecr.ap-south-1.amazonaws.com/jmp-app:preprod-latest
   ```
   Verify with `sudo docker exec jmp printenv BETTER_AUTH_URL`.

3. **Changing `BETTER_AUTH_URL` logs everyone out** — cookies are host-scoped, so a new host
   invalidates existing sessions. Expected; users just sign in again.

4. **App env lives only on the server**, in `/srv/jobtiva/env/<env>.env` (see `VPS.md`). CI never
   writes it, so your edits persist. After an edit, `docker compose up -d app-<env>` re-creates the
   container with the new values.

5. **Google `gmail.readonly` is a restricted scope.** Keep the OAuth consent screen in
   **Testing** and add each connecting account as a **test user** (≤100) — no Google
   verification needed. Publishing to production with a restricted scope requires a paid
   security assessment; don't.

6. **`redirect_uri_mismatch`** means the OAuth client whose ID is in `.env` doesn't have the
   exact redirect URI registered. It must be, character for character:
   `https://<host>/api/auth/callback/google` (no trailing slash, https). The JS origin is
   just `https://<host>`. Check the live client with
   `sudo docker exec jmp printenv GOOGLE_CLIENT_ID` and match it in the Console.

## Current preprod facts

- `preprod.jobtiva.in` → A record → **13.205.239.50** (EC2 Elastic IP, box name `jmp-preprod`).
- DNS is hosted at the jobtiva.in registrar (HostingRaja nameservers). **Keep the apex `NS` record** — deleting it breaks the whole zone.
- Nginx site: `/etc/nginx/sites-available/preprod.jmp.conf`.
- Certs: `/etc/letsencrypt/live/preprod.jobtiva.in/` (app) and `/etc/letsencrypt/live/preprod.jmp.narendragupta.in/` (old host, still used by the 301-redirect block).
- Container image: `504721334099.dkr.ecr.ap-south-1.amazonaws.com/jmp-app:preprod-latest`.
- Google OAuth (project `sturdy-conduit-511311-g6`): client `247994552151-…`, redirect `https://preprod.jobtiva.in/api/auth/callback/google`, JS origin `https://preprod.jobtiva.in`.
- Connect to the box via **SSM Session Manager**; `docker` needs `sudo`; `.env` is `chmod 600` (read with `sudo`).

## Cutover steps (template)

For a host `<H>` (e.g. `preprod.jobtiva.in`, or `jobtiva.in` for prod):

1. **DNS** — at the registrar, add `A  <H> → <EC2 Elastic IP>` (TTL 300). Verify:
   `nslookup <H>` returns the IP (or watch dnschecker.org). Wait until it resolves before step 2.
2. **TLS** — on the box: `sudo certbot certonly --nginx -d <H>` → cert at `/etc/letsencrypt/live/<H>/`.
3. **Env** — on the box, set `BETTER_AUTH_URL=https://<H>` (UNQUOTED) in `.env`. That's the only
   place app env lives; CI reuses this file, so there's nothing else to update.
4. **Nginx** — app server block on `<H>` + a 301 from the old host (template below); `sudo nginx -t && sudo systemctl reload nginx`.
5. **Recreate the container** (see gotcha #2) and confirm `printenv BETTER_AUTH_URL`.
6. **Google OAuth** — on the client in `.env`, add JS origin `https://<H>` and redirect URI `https://<H>/api/auth/callback/google`; consent-screen authorized domain `jobtiva.in`; add test users.
7. **Cron** — set the sync cron's `APP_URL` to `https://<H>` (or `http://127.0.0.1:3000` to bypass DNS/Nginx entirely — more robust). Script: `scripts/cron/jmp-cron.sh`.
8. **Verify** — HTTPS padlock; user login + `/jmp-admin`; Gmail connect (test user); a password-reset email links to `<H>`; cron's next run logs `200`; old host 301s to new.

## Prod specifics (jobtiva.in apex — later)

Prod runs on the same EC2 as preprod (Elastic IP `13.205.239.50`); the full launch checklist is
`VPS.md` section 4. In short, the same template, plus:

- DNS: `A @ → 13.205.239.50`, and `www` → apex (CNAME to `jobtiva.in`, or an A record + a
  www→apex 301 in Nginx).
- Cert: `sudo certbot certonly --nginx -d jobtiva.in -d www.jobtiva.in`.
- `BETTER_AUTH_URL=https://jobtiva.in`.
- Google OAuth: add origin/redirect for `https://jobtiva.in` (and `https://www.jobtiva.in` if used).

## Nginx template (the preprod config we run)

```nginx
# App — new host, HTTPS
server {
    server_name preprod.jobtiva.in;
    client_max_body_size 8m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    listen 443 ssl;
    ssl_certificate /etc/letsencrypt/live/preprod.jobtiva.in/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/preprod.jobtiva.in/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
}

# Old host, HTTPS -> 301 to new
server {
    listen 443 ssl;
    server_name preprod.jmp.narendragupta.in;

    ssl_certificate /etc/letsencrypt/live/preprod.jmp.narendragupta.in/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/preprod.jmp.narendragupta.in/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    return 301 https://preprod.jobtiva.in$request_uri;
}

# Any HTTP (either host) -> HTTPS new host
server {
    listen 80;
    server_name preprod.jobtiva.in preprod.jmp.narendragupta.in;
    return 301 https://preprod.jobtiva.in$request_uri;
}
```

## Retiring the old host

Once the new host is verified, the config above already 301s the old host to the new one.
Later you can drop the old `server_name` blocks, delete the old DNS A record, and let the old
cert lapse (or `sudo certbot delete --cert-name preprod.jmp.narendragupta.in`).
