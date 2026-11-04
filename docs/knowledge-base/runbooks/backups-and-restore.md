---
title: Backups and restoring from one
category: Runbooks
summary: Every night both databases and the uploaded files are backed up to the server and to Google Drive. Local copies last 14 days and Drive's 30. Restoring means stopping the app, recreating its database from the dump and putting the files back.
keywords: backup, restore, google drive, rclone, database dump, lost data, recover, uploads
---

The nightly backup at 21:30 UTC saves each environment's database and its uploaded files, such as résumés, into `backups/` on the server, and copies them to Google Drive. Local copies are kept for 14 days and Drive keeps 30. If the Google Drive connection (the rclone gdrive remote) isn't set up, the Drive copy is skipped with a warning in logs/backup.log, so check that log now and then. To run one now: `./backup.sh` as the deploy user in `/srv/jobtiva`.

## Restoring prod

Pick a folder from `backups/`, or bring one back from Drive with `rclone copy gdrive:jobtiva-backups/<stamp> backups/<stamp>`. Then, as the deploy user in `/srv/jobtiva`:

```bash
S=backups/<stamp>
docker compose stop app-prod
docker compose exec -T postgres dropdb -U postgres jmp_prod
docker compose exec -T postgres createdb -U postgres -O jmp_prod jmp_prod
docker compose exec -T postgres pg_restore -U postgres -d jmp_prod --no-owner --role=jmp_prod < $S/jmp_prod.dump
docker run --rm -i -v jobtiva_uploads-prod:/data alpine sh -c 'rm -rf /data/* && tar xzf - -C /data' < $S/uploads-prod.tar.gz
docker compose start app-prod
```

This replaces everything in prod with the backup, so anything since then is lost. For preprod, use the `preprod` names instead.

Test a restore into preprod once. A backup that has never been restored is a hope, not a backup.

## If the whole server is lost

Launch a new server, move the Elastic IP to it, set it up from the deploy kit, and restore the latest dump and files from Google Drive.
