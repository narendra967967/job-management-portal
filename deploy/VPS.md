# Hostinger VPS runbook (preprod + prod)

Both environments run on **one Hostinger KVM 1** (1 vCPU · 4 GB RAM · 50 GB NVMe, Ubuntu 24.04).
No AWS, no container registry: CI builds the image and ships it over SSH.
This replaces the AWS setup (EC2 + RDS + S3 + ECR). For DNS/OAuth details see `DOMAIN.md`; its
cutover template still applies.

```
Internet ─► Nginx (host, :80/:443, Certbot TLS)
              ├─ jobtiva.in, www → apex ─► 127.0.0.1:3000  app-prod     (≤ 900 MB)
              └─ preprod.jobtiva.in      ─► 127.0.0.1:3001  app-preprod  (≤ 700 MB)
                                          postgres:17 on 127.0.0.1:5432 (≤ 768 MB)
                                            DBs: jmp_prod / jmp_preprod, one role each
Docker volumes: pgdata · uploads-prod · uploads-preprod (résumés, at /data/uploads)
cron (deploy user): Gmail sync every 15 min · lead purge nightly · backup 03:00 IST
```

Everything Docker publishes is bound to `127.0.0.1`. That matters because Docker-published
ports **bypass ufw**. Only Nginx and SSH are reachable from outside.

## Layout on the box: `/srv/jobtiva` (owned by `deploy`)

| Path | What | Source |
|---|---|---|
| `docker-compose.yml`, `*.sh`, `crontab.txt`, `nginx/` | deploy kit | synced by CI on every deploy (`deploy/vps/`) |
| `jmp-cron.sh` | cron caller | synced by CI (`scripts/cron/`) |
| `.env` | DB passwords + `PROD_IMAGE`/`PREPROD_IMAGE` | **by hand** once, from `compose.env.example`; `deploy.sh` updates the image tags |
| `env/prod.env`, `env/preprod.env` | app env | **by hand**, from `app.env.example`. **Unquoted values**, `chmod 600` |
| `backups/` | nightly dumps (14 days) | `backup.sh` |
| `logs/` | cron + backup logs | crontab |
| `incoming/` | image tarballs during a deploy | CI (deleted after load) |

App env lives only in `env/*.env`. CI never writes it. To change a value, edit the file and run
`docker compose up -d app-<env>`. That re-creates the container; `restart` would **not** reload
the env.

---

## 1. One-time server setup

In hPanel: pick the **Ubuntu 24.04** image, add your SSH public key, and note the IP.
If you turn on Hostinger's firewall, open 22, 80 and 443 there as well.

As `root`:

```bash
apt update && apt -y full-upgrade
apt -y install nginx certbot python3-certbot-nginx ufw fail2ban unattended-upgrades rclone curl
dpkg-reconfigure -plow unattended-upgrades          # say Yes

# 2 GB swap: headroom for the 1-vCPU / 4 GB box
fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
sysctl -w vm.swappiness=10 && echo 'vm.swappiness=10' > /etc/sysctl.d/99-swap.conf

# Docker (official script) + log rotation so container logs can't fill the disk
curl -fsSL https://get.docker.com | sh
cat > /etc/docker/daemon.json <<'EOF'
{ "log-driver": "local", "log-opts": { "max-size": "20m", "max-file": "3" } }
EOF
systemctl restart docker

# Firewall
ufw default deny incoming && ufw allow OpenSSH && ufw allow 'Nginx Full' && ufw --force enable

# Deploy user: used by you and by CI; can run docker, no sudo
adduser --disabled-password --gecos "" deploy
usermod -aG docker deploy
install -d -o deploy -g deploy -m 750 /srv/jobtiva /srv/jobtiva/env /srv/jobtiva/backups /srv/jobtiva/logs /srv/jobtiva/incoming
install -d -o deploy -g deploy -m 700 /home/deploy/.ssh
cp /root/.ssh/authorized_keys /home/deploy/.ssh/ && chown deploy:deploy /home/deploy/.ssh/authorized_keys
```

Lock SSH down. First confirm `ssh deploy@<IP>` works in a second terminal.

```bash
cat > /etc/ssh/sshd_config.d/90-hardening.conf <<'EOF'
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin prohibit-password
EOF
systemctl reload ssh
```

### CI deploy key

On your laptop, make a dedicated key for GitHub Actions. Give it no passphrase and use it only
for this:

```bash
ssh-keygen -t ed25519 -f jobtiva-ci -C "github-actions@jobtiva" -N ""
```

Append `jobtiva-ci.pub` to `/home/deploy/.ssh/authorized_keys` on the VPS.
`jobtiva-ci` (the private half) goes into GitHub (step 2). Then delete it from the laptop.

### First copy of the kit + bootstrap (as `deploy`)

CI syncs the kit on every deploy. The very first time, copy it yourself. From the repo root on
the laptop:

```bash
scp -r deploy/vps/* scripts/cron/jmp-cron.sh deploy@<IP>:/srv/jobtiva/
```

Then on the VPS, as `deploy`:

```bash
cd /srv/jobtiva && chmod +x *.sh
cp compose.env.example .env && chmod 600 .env && nano .env      # 3 DB passwords (openssl rand -hex 24)
docker compose up -d postgres                                   # creates jmp_prod + jmp_preprod on first start
docker compose ps                                               # postgres "healthy"
crontab crontab.txt
```

The DB passwords are read **once**, on the first start of an empty `pgdata` volume. Changing them
later means `ALTER ROLE … PASSWORD` as well as editing the env files.

### Nginx

As `root`:

```bash
cp /srv/jobtiva/nginx/jobtiva-proxy.conf /etc/nginx/snippets/
cp /srv/jobtiva/nginx/preprod.jobtiva.in.conf /etc/nginx/sites-available/
ln -s /etc/nginx/sites-available/preprod.jobtiva.in.conf /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
```

TLS comes after DNS points here (section 3, step 6).

### Google Drive backups (rclone)

Backups contain résumés and user data, so **encrypt them**. Use an rclone *crypt* remote named
`gdrive`, layered over a plain Drive remote. `backup.sh` only knows the name `gdrive`.

1. As `deploy`, run `rclone config`:
   - Create `gdrive-raw`: type `drive`, scope `drive.file`.
   - "Use auto config?" → **n**. On the laptop, run the `rclone authorize "drive" …` command it
     prints, sign in with the Google account that should hold the backups, and paste the token
     back.
2. Run `rclone config` again:
   - Create `gdrive`: type `crypt`, remote `gdrive-raw:jobtiva`, filename encryption `standard`.
   - Let it **generate** both passwords.
   - **Save both passwords in your password manager.** Without them the backups cannot be read.
3. Test:
   ```bash
   /srv/jobtiva/backup.sh && rclone ls gdrive:jobtiva-backups | head
   ```

If you skip rclone, backups stay local only and the log shows a warning every night.

---

## 2. GitHub setup

Go to **Settings → Secrets and variables → Actions**.

| Secret | Value |
|---|---|
| `VPS_HOST` | VPS IP |
| `VPS_USER` | `deploy` |
| `VPS_SSH_KEY` | contents of the private key `jobtiva-ci` |
| `VPS_KNOWN_HOSTS` | output of `ssh-keyscan -t ed25519 <IP>`. Run it from your laptop and check the fingerprint against `ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub` on the box |

| Variable | Value |
|---|---|
| `PREPROD_TARGET` | `vps`. Set this only at cutover (section 3, step 7). Until then, pushes to `preprod` still go to AWS |

**Settings → Environments → New environment `production`**: add yourself as **Required reviewer**
and restrict deployment branches to `prod`. Every prod deploy then waits for your click.

Workflows:

- **`deploy-preprod-vps.yml`** — runs on push to `preprod` when `PREPROD_TARGET=vps`.
- **`deploy-prod.yml`** — runs on push to `prod`, after approval.
- **`deploy-preprod.yml`** — the legacy AWS workflow. It skips itself once `PREPROD_TARGET=vps`.

All three call `deploy/vps/ci-ship.sh`, which:

1. syncs the kit;
2. builds and ships the image, unless that exact commit's image is already on the box;
3. runs `deploy.sh`.

`deploy.sh` then:

1. runs migrations from the new image;
2. switches the container;
3. health-checks `/login`;
4. **rolls back automatically** if the health check fails;
5. keeps the 5 newest images for rollback.

**Promote, don't rebuild:** fast-forward `prod` to the commit preprod tested
(`git merge --ff-only preprod`). Same SHA means the exact image you tested on preprod goes live.
A non-fast-forward merge still works, but it builds a fresh image.

---

## 3. Preprod cutover (AWS → VPS)

Expect about 15 minutes of preprod downtime. Do steps 1–3 in one sitting so no new data lands on
AWS after the dump.

0. **Before you start:** merge this work into `preprod` and push it. With `PREPROD_TARGET` still
   unset it deploys to AWS as usual. The AWS box keeps using S3 because `S3_BUCKET` is set there,
   and its checkout now contains `db/resumes-s3-to-db.ts`.

1. **Pull résumés off S3 into the DB.** Run this on the AWS preprod box (SSM session):
   ```bash
   cd /home/ubuntu/job-management-portal
   sudo docker run --rm --env-file .env -v "$PWD:/app" -w /app node:22-bookworm-slim \
     bash -lc "npm ci --no-audit --no-fund && npx tsx db/resumes-s3-to-db.ts"
   ```
   The script prints how many it copied. S3 is left untouched as a fallback. The running AWS app
   keeps serving the files from the DB.

2. **Stop writes, then dump.** On the AWS box:
   ```bash
   sudo docker stop jmp
   sudo docker run --rm --env-file .env postgres:17 sh -c 'psql "$DATABASE_URL" -tAc "show server_version"'   # must be ≤ 17
   sudo docker run --rm --env-file .env postgres:17 sh -c 'pg_dump -Fc --no-owner --no-acl "$DATABASE_URL"' > /tmp/preprod.dump
   ls -lh /tmp/preprod.dump
   ```
   If `psql` rejects the URL's `sslmode`, replace it with `sslmode=require` for this command.
   `no-verify` is a node-pg-only value.

3. **Copy the dump and the secrets to the VPS.**
   - The dump: on the AWS box, make a throwaway key with
     `ssh-keygen -t ed25519 -f /tmp/k -N ""`. Append `/tmp/k.pub` to the VPS
     `deploy` `authorized_keys`. Then run:
     ```bash
     scp -i /tmp/k /tmp/preprod.dump deploy@<VPS-IP>:/srv/jobtiva/incoming/
     ```
     Afterwards, remove that key line from the VPS and `rm /tmp/k*`.
   - The secrets: run `sudo cat .env` on the AWS box and copy these values into
     `/srv/jobtiva/env/preprod.env` (from `app.env.example`):
     `BETTER_AUTH_SECRET`, **`APP_ENCRYPTION_KEY` (must be the same, or saved AI keys and Gmail
     tokens become unreadable)**, `CRON_SECRET`, `GOOGLE_CLIENT_ID`/`SECRET`, and any `SMTP_*`.
   - Set the rest yourself:
     - `DATABASE_URL=postgresql://jmp_preprod:<PREPROD_DB_PASSWORD>@postgres:5432/jmp_preprod`
     - `BETTER_AUTH_URL=https://preprod.jobtiva.in`
     - `STORAGE_DRIVER=local`
     - `APP_ENV=Preprod`
   - Then run `chmod 600 env/preprod.env`.

4. **Restore** (VPS, as `deploy`). The database must still be empty: no deploy has run yet.
   ```bash
   cd /srv/jobtiva
   docker compose exec -T postgres pg_restore -U postgres -d jmp_preprod --no-owner --role=jmp_preprod \
     < incoming/preprod.dump && rm incoming/preprod.dump
   ```

5. **First deploy.** On GitHub, set the variable `PREPROD_TARGET=vps`. Then go to
   **Actions → Deploy preprod (VPS) → Run workflow** on `preprod`. It applies any newer
   migrations and starts `app-preprod`. Then move the résumés onto disk:
   ```bash
   docker compose run --rm --no-deps app-preprod node scripts/files-db-to-disk.mjs
   ```
   This is idempotent. It verifies each file before deleting the DB copy.

6. **DNS + TLS.** At the registrar, point `preprod.jobtiva.in` A to the VPS IP (TTL 300). Keep
   the apex NS record. Once `nslookup preprod.jobtiva.in` returns the VPS IP, run as `root`:
   ```bash
   certbot --nginx -d preprod.jobtiva.in --redirect -m <your-email> --agree-tos
   ```
   Renewal is automatic via certbot's systemd timer. Check it with `certbot renew --dry-run`.

7. **Verify.**
   - HTTPS works; user login and `/jmp-admin` work.
   - An existing résumé opens, and a new upload works.
   - Gmail connect works: the Google client is the same, and the redirect URI is unchanged.
   - `tail /srv/jobtiva/logs/cron.log` shows `200`s.
   - After a push to `preprod`, the deploy goes green.

8. Leave AWS **stopped but intact** for a week as the rollback. To roll back: point DNS back,
   start the `jmp` container on AWS, and unset `PREPROD_TARGET`.

---

## 4. Prod launch on `jobtiva.in`

1. **Env.** Create `/srv/jobtiva/env/prod.env` from `app.env.example` with **fresh** secrets
   (`openssl rand -base64 32` / `-hex 32`):
   - `DATABASE_URL=postgresql://jmp_prod:<PROD_DB_PASSWORD>@postgres:5432/jmp_prod`
   - `BETTER_AUTH_URL=https://jobtiva.in`
   - `APP_ENV=Production`
   - then `chmod 600`.
2. **Nginx.** As `root`:
   ```bash
   cp /srv/jobtiva/nginx/jobtiva.in.conf /etc/nginx/sites-available/
   ln -s /etc/nginx/sites-available/jobtiva.in.conf /etc/nginx/sites-enabled/
   nginx -t && systemctl reload nginx
   ```
3. **DNS.** Point the `@` A record and the `www` A record (or a CNAME to `jobtiva.in`) at the VPS
   IP. Once both resolve:
   ```bash
   certbot --nginx -d jobtiva.in -d www.jobtiva.in --redirect
   ```
4. **Deploy.** Fast-forward `prod` to the tested preprod commit and push (you do this). Approve
   the run in Actions. Migrations build the empty schema.
5. **First admin.** **Never run `db:seed` here**: it wipes tables and creates known passwords.
   Use the non-destructive `db:add-user` over an SSH tunnel from the laptop:
   ```bash
   ssh -N -L 15432:127.0.0.1:5432 deploy@<VPS-IP>        # leave running
   # second terminal, repo root:
   DATABASE_URL=postgresql://jmp_prod:<PROD_DB_PASSWORD>@127.0.0.1:15432/jmp_prod \
   ADD_USER_EMAIL=<admin email> ADD_USER_PASSWORD=<strong password> ADD_USER_NAME="Admin" \
   ADD_USER_ROLE=admin npm run db:add-user
   ```
6. **Configure in `/jmp-admin`.**
   - Branding and tagline.
   - SMTP (Settings → Email); send a test email.
   - Create the **default Free plan**. Registration stays closed until one exists.
   - Then decide whether self sign-up should be on.
7. **Google OAuth.** On the same client, add the JS origin `https://jobtiva.in` and the redirect
   URI `https://jobtiva.in/api/auth/callback/google`. Add the test users who will connect Gmail.
8. **Verify.** Run the same checks as preprod, plus:
   - `www` redirects with a 301;
   - `/privacy` and `/terms` load;
   - a sign-up verification email links to `https://jobtiva.in`.

---

## 5. Day-2 operations

All commands run as `deploy` in `/srv/jobtiva`.

| Task | Command |
|---|---|
| Status / memory | `docker compose ps` · `docker stats --no-stream` · `free -h` · `df -h` |
| Logs | `docker compose logs -f --tail 100 app-prod` (or `app-preprod`, `postgres`) |
| Roll back | `./deploy.sh prod <older-sha>`. The last 5 images stay on the box; list them with `docker images jobtiva` |
| Apply an env change | edit `env/prod.env`, then `docker compose up -d app-prod` |
| Run a cron job now | `./cron-run.sh prod sync` |
| Backup now | `./backup.sh` |
| psql | `docker compose exec postgres psql -U postgres -d jmp_prod` |

### Restore from a backup

Pick a folder from `backups/` (or run `rclone copy gdrive:jobtiva-backups/<stamp> backups/<stamp>`).
For `<env>` = `prod`:

```bash
S=backups/<stamp>
docker compose stop app-prod
docker compose exec -T postgres dropdb -U postgres jmp_prod
docker compose exec -T postgres createdb -U postgres -O jmp_prod jmp_prod
docker compose exec -T postgres pg_restore -U postgres -d jmp_prod --no-owner --role=jmp_prod < $S/jmp_prod.dump
docker run --rm -i -v jobtiva_uploads-prod:/data alpine sh -c 'rm -rf /data/* && tar xzf - -C /data' < $S/uploads-prod.tar.gz
docker compose start app-prod
```

**Test a restore once into preprod.** A backup you have never restored is a hope, not a backup.

### Capacity notes

- **Memory:** about 2.4 GB is capped across the 3 containers, plus Nginx and the OS, with 2 GB
  swap as a buffer.
- **CPU:** builds happen in CI, never on the box. The single vCPU only serves traffic.
- **Disk:** check `df -h` now and then. Images take about 0.5 GB each, 5 are kept, and
  `deploy.sh` prunes the rest.

---

## 6. Shut down AWS

Do this after prod has run cleanly on the VPS for about a week:

1. In GitHub, delete the AWS workflow and the AWS role/OIDC references. Code cleanup:
   - remove `lib/s3.ts`;
   - remove the `@aws-sdk/client-s3` dependency and its `serverExternalPackages` entry in
     `next.config`;
   - remove `deploy/preprod-remote.sh`, `db/resumes-s3-to-db.ts`, and the S3 vars.
2. In the AWS console (ap-south-1):
   - **EC2:** terminate the preprod instance. **Release the Elastic IP**: an unattached EIP is
     billed.
   - **RDS:** optionally take a final snapshot, export it, and delete that snapshot later. Then
     delete the instance.
   - **S3:** empty and delete the bucket.
   - **ECR:** delete the `jmp-app` repository.
   - **SSM:** remove the parameters, if any.
   - **IAM:** delete the `jmp-github-actions` role and the GitHub OIDC provider.
   - **CloudWatch:** delete the log groups.
3. A few days later, check **Billing → Bills**. Nothing in ap-south-1 should still be accruing.
