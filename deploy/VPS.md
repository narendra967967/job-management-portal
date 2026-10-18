# Server runbook (preprod + prod on one AWS EC2)

Both environments run on **one AWS EC2 `t4g.small` in Mumbai (ap-south-1)**: 2 vCPU (ARM/Graviton),
2 GB RAM, 20 GB gp3 disk, Ubuntu 24.04. The same box also serves the static portfolio site
**narendragupta.in** (see "Other sites on this server").

It replaces the old AWS setup (EC2 t3.micro + RDS + S3 + ECR + SSM deploys). Only the server itself
is paid for now; there's no managed database and no container registry: CI builds the image and ships
it over SSH. The box **reuses the existing Elastic IP `13.205.239.50`**, so the DNS for
preprod.jobtiva.in and narendragupta.in does not change. For DNS/OAuth details see `DOMAIN.md`.

```
Internet ─► 13.205.239.50 (Elastic IP) ─► Security group (22, 80, 443) ─► ufw
            Nginx (host, :80/:443, Certbot TLS)
              ├─ jobtiva.in, www → apex ─► 127.0.0.1:3000  app-prod     (≤ 576 MB)
              ├─ preprod.jobtiva.in      ─► 127.0.0.1:3001  app-preprod  (≤ 448 MB)
              └─ narendragupta.in, www   ─► static files in /srv/portfolio/current
            postgres:18 on 127.0.0.1:5432 (≤ 384 MB) · DBs jmp_prod / jmp_preprod, one role each
Docker volumes: pgdata · uploads-prod · uploads-preprod (résumés, at /data/uploads)
cron (deploy user): Gmail sync every 15 min · lead purge nightly · backup 03:00 IST
```

Everything Docker publishes is bound to `127.0.0.1`. That matters because Docker-published
ports **bypass ufw**. Only Nginx and SSH are reachable from outside.

## Cost (Mumbai, on-demand, before GST)

| Item | Until 31 Dec 2026 | From Jan 2027 |
|---|---|---|
| t4g.small | $0 (AWS t4g.small free trial, 750 h/month) | $0.0112/h ≈ $8.18/mo |
| Public IPv4 (the Elastic IP) | $0.005/h ≈ $3.65/mo | same |
| 20 GB gp3 | ≈ $1.82/mo | same |
| Data transfer out | first 100 GB/mo free | same |
| **Total** | **≈ $5.5/mo** | **≈ $13.7/mo** |

Indian accounts billed by AWS India add 18% GST. Set an **AWS Budgets** alert (free) at $6/month
so a surprise shows up by email, not on the bill.

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

Throughout this runbook, **"as `root`"** means `ssh ubuntu@<IP>` then `sudo -i`, and
**"as `deploy`"** means `ssh deploy@<IP>`. Until the Elastic IP moves (section 3), `<IP>` is the
instance's temporary public IP; afterwards it is `13.205.239.50`.

### Launching the EC2 instance

Region **Asia Pacific (Mumbai) ap-south-1** (top-right of the console). Same region and default VPC
as the old box and RDS: the Elastic IP can only move within a region, and the preprod dump is
taken straight from RDS over the VPC.

1. **IAM role for emergency access** (IAM → Roles → Create role → AWS service → EC2): attach only
   **`AmazonSSMManagedInstanceCore`**, name it `jobtiva-ec2-ssm`. It's free, and it lets you open a
   shell from the console (Systems Manager → Session Manager) even if SSH or ufw locks you out.
2. **Key pair** (EC2 → Key pairs → Actions → **Import key pair**): paste your laptop's **public**
   key (`~/.ssh/id_ed25519.pub`; create one with `ssh-keygen -t ed25519` if you have none).
   Name it `jobtiva-laptop`.
3. **EC2 → Launch instance:**
   - **Name:** `jobtiva`
   - **AMI:** Ubuntu Server **24.04 LTS**, architecture **64-bit (Arm)**
   - **Instance type:** **`t4g.small`**
   - **Key pair:** `jobtiva-laptop`
   - **Network settings → Edit:** default VPC; **Auto-assign public IP: Enable** (temporary, for
     setup); **Create security group** `jobtiva-sg` with inbound:
     - SSH 22 from **Anywhere 0.0.0.0/0**. GitHub Actions deploys over SSH from changing IPs.
       Login is key-only (passwords are switched off below) and fail2ban bans brute-forcers.
     - HTTP 80 and HTTPS 443 from **Anywhere**.
   - **Storage:** **20 GiB, gp3**
   - **Advanced details:**
     - IAM instance profile: `jobtiva-ec2-ssm`
     - Termination protection: **Enable**
     - Credit specification: **Standard**. In "Unlimited" mode a sustained CPU burst is billed
       extra; in Standard it just slows down to the baseline.
4. Launch, wait for **2/2 status checks**, and note the **Public IPv4 address**.
5. **Billing → Budgets → Create budget** → Monthly cost budget, $6, email alerts at 80% and 100%.

What EC2 gives you (and doesn't):

- The login user is **`ubuntu`** (with sudo). Root SSH is disabled; get root with `sudo -i`.
- **No automatic backups.** Our `backup.sh` (Postgres dump + uploads → Google Drive) is the
  backup. Optional whole-disk safety net: EC2 → Lifecycle Manager → daily EBS snapshot, keep 3.
  Snapshots are incremental and cost roughly $0.05 per GB-month actually stored (check the Mumbai
  price on the EBS pricing page before enabling).
- **Lockout recovery:** Systems Manager → Session Manager → Start session (thanks to the IAM role).
  The SSM agent ships with Canonical's Ubuntu AMIs.
- The security group is the outer firewall; ufw on the box is a second layer.

```bash
ssh ubuntu@<IP>
sudo -i
```

Then, as `root`:

```bash
apt update && apt -y full-upgrade
apt -y install nginx certbot python3-certbot-nginx ufw fail2ban unattended-upgrades rclone curl postgresql-client
dpkg-reconfigure -plow unattended-upgrades          # say Yes

# 2 GB swap: overflow for the 2 GB box (EC2 Ubuntu images ship without swap)
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
cp /home/ubuntu/.ssh/authorized_keys /home/deploy/.ssh/ && chown deploy:deploy /home/deploy/.ssh/authorized_keys
```

Lock SSH down. First confirm `ssh deploy@<IP>` works in a second terminal. Keep using
`ubuntu@<IP>` + `sudo -i` for root work; `deploy` deliberately has no sudo.

```bash
cat > /etc/ssh/sshd_config.d/90-hardening.conf <<'EOF'
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin no
EOF
sshd -t && systemctl reload ssh
```

If a later step locks you out, use Session Manager (above).

### CI deploy key

On your laptop, make a dedicated key for GitHub Actions. Give it no passphrase and use it only
for this:

```bash
ssh-keygen -t ed25519 -f jobtiva-ci -C "github-actions@jobtiva" -N ""
```

Append `jobtiva-ci.pub` to `/home/deploy/.ssh/authorized_keys` on the server.
`jobtiva-ci` (the private half) goes into GitHub (step 2). Then delete it from the laptop.

### First copy of the kit + bootstrap (as `deploy`)

CI syncs the kit on every deploy. The very first time, copy it yourself. From the repo root on
the laptop:

```bash
scp -r deploy/vps/* scripts/cron/jmp-cron.sh deploy@<IP>:/srv/jobtiva/
```

Then on the server, as `deploy`:

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

TLS comes after the Elastic IP moves here (section 3).

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

### Portfolio

Set up the `portfolio` user and `/srv/portfolio` now, following the portfolio-website repo's
`deploy/VPS.md`, up to (not including) DNS/TLS. Its first publish happens at cutover.

---

## 2. GitHub setup

Go to **Settings → Secrets and variables → Actions**.

| Secret | Value |
|---|---|
| `VPS_HOST` | `13.205.239.50` (set at cutover, after the Elastic IP moves) |
| `VPS_USER` | `deploy` |
| `VPS_SSH_KEY` | contents of the private key `jobtiva-ci` |
| `VPS_KNOWN_HOSTS` | output of `ssh-keyscan -t ed25519 13.205.239.50`, run from your laptop **after** the Elastic IP moves. Check the fingerprint against `ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub` on the box |

| Variable | Value |
|---|---|
| `PREPROD_TARGET` | `vps`. Set this only at cutover (section 3). Until then, pushes to `preprod` still go to the old AWS box |

**Settings → Environments → New environment `production`**: add yourself as **Required reviewer**
and restrict deployment branches to `prod`. Every prod deploy then waits for your click.

Workflows:

- **`deploy-preprod-vps.yml`** — runs on push to `preprod` when `PREPROD_TARGET=vps`.
- **`deploy-prod.yml`** — runs on push to `prod`, after approval.
- **`deploy-preprod.yml`** — the legacy AWS workflow (ECR + SSM). It skips itself once
  `PREPROD_TARGET=vps`.

The two server workflows run on GitHub's **ARM runner (`ubuntu-24.04-arm`)**, so images are built
natively for the Graviton box. In a private repo these use the plan's free Actions minutes. Both call
`deploy/vps/ci-ship.sh`, which:

1. syncs the kit;
2. builds and ships the image, unless that exact commit's image is already on the box;
3. runs `deploy.sh`.

`deploy.sh` then:

1. runs migrations from the new image;
2. switches the container;
3. health-checks `/login`;
4. **rolls back automatically** if the health check fails;
5. keeps the 3 newest images for rollback.

**Promote, don't rebuild:** fast-forward `prod` to the commit preprod tested
(`git merge --ff-only preprod`). Same SHA means the exact image you tested on preprod goes live.
A non-fast-forward merge still works, but it builds a fresh image.

---

## 3. Cutover: preprod + portfolio (old AWS box → new EC2)

Do sections 1 and 2 first (except the secrets marked "at cutover"); none of that touches the live
sites. The cutover itself takes about 20–30 minutes of downtime for preprod and the portfolio. Do it
in one sitting so no new data lands on RDS after the dump.

0. **Before you start:**
   - Merge this work into `preprod` and push it. With `PREPROD_TARGET` still unset it deploys to
     the old box as usual, which keeps using S3 (`S3_BUCKET` is set there).
   - Prepare `/srv/jobtiva/env/preprod.env` on the new box (from `app.env.example`). In a Session
     Manager shell on the **old** box, `sudo cat /home/ubuntu/job-management-portal/.env` and copy:
     `BETTER_AUTH_SECRET`, **`APP_ENCRYPTION_KEY` (must be the same, or saved AI keys and Gmail
     tokens become unreadable)**, `CRON_SECRET`, `GOOGLE_CLIENT_ID`/`SECRET`, and any `SMTP_*`.
     Set the rest yourself:
     - `DATABASE_URL=postgresql://jmp_preprod:<PREPROD_DB_PASSWORD>@postgres:5432/jmp_preprod`
     - `BETTER_AUTH_URL=https://preprod.jobtiva.in`
     - `STORAGE_DRIVER=local`
     - `APP_ENV=Preprod`

     Then `chmod 600 env/preprod.env`. Note the old box's `DATABASE_URL` too (the RDS one); step 3
     needs it.
   - Let the new box reach RDS: EC2 → Instances → `jobtiva` → Actions → Security → **Change security
     groups** → add **`jmp-ec2-sg`** (the old box's group, which RDS already trusts). It's removed
     again in section 6.

1. **Pull résumés off S3 into the DB.** On the old box (Session Manager):
   ```bash
   cd /home/ubuntu/job-management-portal
   sudo docker run --rm --env-file .env -v "$PWD:/app" -w /app node:22-bookworm-slim \
     bash -lc "npm ci --no-audit --no-fund && npx tsx db/resumes-s3-to-db.ts"
   ```
   The script prints how many it copied. S3 is left untouched as a fallback.

2. **Stop the old app and its cron** (old box):
   ```bash
   sudo docker stop jmp
   sudo crontab -l -u ubuntu; sudo crontab -l     # find the gmail-sync line (ubuntu's or root's)
   ```
   Comment that line out with `sudo crontab -e -u ubuntu` (or `sudo crontab -e` if it is root's).
   From here on, preprod is down.

3. **Dump straight from RDS, then restore** (new box, as `deploy`). The `read` keeps the RDS
   password out of shell history; use the old `DATABASE_URL` with `sslmode=require` in place of
   `no-verify` (a node-pg-only value):
   ```bash
   cd /srv/jobtiva
   read -rs RDS_URL; export RDS_URL                     # paste the URL, press Enter
   psql "$RDS_URL" -tAc "show server_version"           # must be ≤ 18
   docker run --rm -e RDS_URL postgres:18-bookworm sh -c 'pg_dump -Fc --no-owner --no-acl "$RDS_URL"' > incoming/preprod.dump
   ls -lh incoming/preprod.dump
   docker compose exec -T postgres pg_restore -U postgres -d jmp_preprod --no-owner --role=jmp_preprod \
     < incoming/preprod.dump && rm incoming/preprod.dump
   unset RDS_URL
   ```
   The `jmp_preprod` database must still be empty: no deploy has run yet.

4. **Move the Elastic IP.** EC2 → **Elastic IPs** → select `13.205.239.50` → Actions → **Associate
   Elastic IP address** → Instance: `jobtiva` → tick **Allow this Elastic IP address to be
   reassociated** → Associate. The new box's temporary public IP is released automatically, and
   preprod.jobtiva.in and narendragupta.in now point at it. Your laptop: `ssh deploy@13.205.239.50`
   (if SSH warns that the host key changed, run `ssh-keygen -R 13.205.239.50` once).

5. **First preprod deploy.** In GitHub, set `VPS_HOST` and `VPS_KNOWN_HOSTS` (section 2), then the
   variable `PREPROD_TARGET=vps`. Go to **Actions → Deploy preprod (VPS) → Run workflow** on
   `preprod`. It applies any newer migrations and starts `app-preprod`. Then move the résumés onto
   disk:
   ```bash
   docker compose run --rm --no-deps app-preprod node scripts/files-db-to-disk.mjs
   ```
   This is idempotent. It verifies each file before deleting the DB copy.

6. **TLS** (as `root`). DNS already points here, so this works straight away:
   ```bash
   certbot --nginx -d preprod.jobtiva.in --redirect -m <your-email> --agree-tos
   ```
   Renewal is automatic via certbot's systemd timer. Check it with `certbot renew --dry-run`.

7. **Portfolio.** In the portfolio-website repo, set its secrets and `PORTFOLIO_TARGET=vps`, run
   its deploy workflow, then add its certificate (that repo's `deploy/VPS.md`).

8. **Verify.**
   - HTTPS works; user login and `/jmp-admin` work.
   - An existing résumé opens, and a new upload works.
   - Gmail connect works: the Google client is the same, and the redirect URI is unchanged.
   - `tail /srv/jobtiva/logs/cron.log` shows `200`s.
   - After a push to `preprod`, the deploy goes green.
   - https://narendragupta.in and `www` load.

9. **Rollback (if needed):** move the Elastic IP back to the old instance, `sudo docker start jmp`
   and restore its crontab there, then unset `PREPROD_TARGET`. Keep the old instance **stopped** and
   RDS **stopped** (both keep their data; RDS restarts by itself after 7 days) until section 6.

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
3. **DNS.** Point the `@` A record and the `www` A record (or a CNAME to `jobtiva.in`) at
   `13.205.239.50`. Once both resolve:
   ```bash
   certbot --nginx -d jobtiva.in -d www.jobtiva.in --redirect
   ```
4. **Deploy.** Fast-forward `prod` to the tested preprod commit and push (you do this). Approve
   the run in Actions. Migrations build the empty schema.
5. **First admin.** **Never run `db:seed` here**: it wipes tables and creates known passwords.
   Use the non-destructive `db:add-user` over an SSH tunnel from the laptop:
   ```bash
   ssh -N -L 15432:127.0.0.1:5432 deploy@13.205.239.50        # leave running
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
| Roll back | `./deploy.sh prod <older-sha>`. The last 3 images stay on the box; list them with `docker images jobtiva` |
| Apply an env change | edit `env/prod.env`, then `docker compose up -d app-prod` |
| Free memory when not testing | `docker compose stop app-preprod` (start it again with `docker compose up -d app-preprod`) |
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

If the whole server is lost, launch a fresh instance (section 1), move the Elastic IP to it, and
restore the latest dump + uploads from Google Drive. If you enabled EBS snapshots, you can instead
create a volume from the latest snapshot and attach it.

### Capacity notes

- **Memory (2 GB):** about 1.4 GB is capped across the 3 containers (Postgres 384 MB with
  `shared_buffers=128MB`, prod 576 MB, preprod 448 MB), plus Nginx and the OS, with 2 GB swap as
  the overflow. The portfolio is static and uses none. If `free -h` shows swap in steady use,
  stop preprod when you're not testing, or resize (below).
- **CPU:** builds happen in CI, never on the box. The t4g.small runs at full speed in bursts and
  falls back to its baseline when the burst allowance is used up (Standard credit mode: no extra
  charge). EC2's Monitoring tab shows **CPUCreditBalance**; if it sits near zero, resize.
- **Disk (20 GB):** check `df -h` and `docker system df` now and then. Rough budget:
  - OS: about 3 GB; swap file 2 GB.
  - Images: about 0.5 GB each; 3 are kept and `deploy.sh` prunes the rest; Postgres image 0.4 GB.
  - Postgres and uploads: small today.
  - Local backups: 14 days.

  If disk gets tight, cut local backup retention in `backup.sh` first (Drive still keeps 30 days),
  or grow the volume: EC2 → Volumes → Modify (no downtime), then `growpart` + `resize2fs`.
- **Traffic:** the first 100 GB/month out is free; this app should stay at a few GB.
- **Upgrade path:** stop the instance → Actions → Instance settings → **Change instance type** →
  `t4g.medium` (4 GB, ≈ $16.35/mo) → start. The disk, data and Elastic IP stay. Then raise the
  `mem_limit`s and `NODE_OPTIONS` in `docker-compose.yml`.

---

## Other sites on this server

**narendragupta.in** (the owner's portfolio) is a static Astro build that Nginx serves directly.
It uses no containers and no memory budget. Its setup, CI and runbook live in the
**portfolio-website** repo (`deploy/VPS.md` there).

Kept deliberately apart from Jobtiva:

- its own Linux user, `portfolio`, with no Docker access and no sudo, owning only
  `/srv/portfolio`;
- its own CI key;
- its own Nginx site file and certificate.

A leaked portfolio deploy key therefore can't reach Jobtiva's database or uploads. Don't add the
`portfolio` user to the docker group, and don't give the portfolio repo the Jobtiva `deploy` key.

---

## 6. Shut down the old AWS pieces

The old pieces keep costing money (RDS above all), so don't leave them longer than needed. After
preprod and the portfolio have run cleanly on the new box for a few days:

1. In GitHub, delete the legacy AWS workflow and the AWS role/OIDC references (also in the
   portfolio repo). Code cleanup:
   - remove `lib/s3.ts`;
   - remove the `@aws-sdk/client-s3` dependency and its `serverExternalPackages` entry in
     `next.config`;
   - remove `deploy/preprod-remote.sh`, `db/resumes-s3-to-db.ts`, and the S3 vars.
2. In the AWS console (ap-south-1):
   - **EC2:** terminate the old instance `jmp-preprod` (`i-085d2024533e968fd`). **Do not release
     the Elastic IP**: it now belongs to `jobtiva`. Then remove `jmp-ec2-sg` from `jobtiva`'s
     security groups and delete `jmp-ec2-sg`.
   - **RDS:** optionally take a final snapshot, export it, and delete that snapshot later. Then
     delete the instance `jmp-db` and its security group `jmp-rds-sg`.
   - **S3:** empty and delete the bucket `jmp-preprod-resumes`.
   - **ECR:** delete the `jmp-app` repository.
   - **SSM Parameter Store:** remove the `/jmp/*` parameters, if any.
   - **IAM:** delete the `jmp-github-actions` role, the GitHub OIDC provider, and
     `jmp-ec2-preprod-role`. Keep `jobtiva-ec2-ssm`.
   - **CloudWatch:** delete the old log groups.
3. A few days later, check **Billing → Bills**. In ap-south-1 only the `jobtiva` instance, its
   20 GB volume and one public IPv4 address should still be accruing.
