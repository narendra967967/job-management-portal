# Cron setup (AWS)

We run on AWS (EC2 + Docker), so **use a host-side scheduler — not GitHub Actions.**
GitHub Actions was only in the original plan because Vercel's Hobby cron ran once a
day; on our own EC2 box the OS scheduler is simpler, has no extra dependency, and
keeps the secret on the host.

There are two scheduled jobs, both protected by the bearer `CRON_SECRET` and both
safe to call repeatedly:

| Job | Route | Schedule | Behavior |
|-----|-------|----------|----------|
| Gmail sync | `POST /api/cron/gmail-sync` | every 15 min | Each user syncs only if their own interval has elapsed; all syncs pause during admin **quiet hours**. |
| Lead purge | `POST /api/cron/purge-leads` | daily | No-op unless **Lead retention** is enabled in admin Settings → Cron. Deletes stale leads, logs each run, and emails + notifies the user. |

## Option A — EC2 crontab (recommended)

1. Put the secret + URL in a root-only env file, e.g. `/etc/jmp-cron.env`:

   ```
   APP_URL=https://app.example.com
   CRON_SECRET=<same value as the server's CRON_SECRET>
   ```
   `chmod 600 /etc/jmp-cron.env`

2. Copy `scripts/cron/jmp-cron.sh` onto the host and make it executable:
   `chmod +x /opt/jmp/jmp-cron.sh`

3. Add to the crontab (`crontab -e`):

   ```cron
   */15 * * * * set -a; . /etc/jmp-cron.env; /opt/jmp/jmp-cron.sh sync  >> /var/log/jmp-cron.log 2>&1
   0    3 * * * set -a; . /etc/jmp-cron.env; /opt/jmp/jmp-cron.sh purge >> /var/log/jmp-cron.log 2>&1
   ```

   The purge runs daily at 03:00 **server time** — set the box's timezone (or adjust
   the hour) to a low-traffic window.

## Option B — Docker sidecar

If you'd rather keep it in the compose stack, add a tiny cron container (e.g.
`alpine` with `curl` + a crontab, or a dedicated cron image) on the same network,
calling `http://app:3000/api/cron/...` with the secret from the compose env. Same
two schedules as above.

## Notes

- `APP_URL` can be the public HTTPS URL, or an internal address if the scheduler
  runs where it can reach the app directly.
- Check `/var/log/jmp-cron.log` for the `-> 200` lines; a `401` means the
  `CRON_SECRET` doesn't match.
- Changing the admin session-length setting needs an app restart to take effect
  (it's read at startup) — unrelated to cron, noted here since both are ops tasks.
