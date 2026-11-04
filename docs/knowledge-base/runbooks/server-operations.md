---
title: Everyday server tasks: logs, settings changes, memory
category: Runbooks
summary: Run everything as the deploy user in /srv/jobtiva. The containers are app-prod, app-preprod, postgres and mail-in. Changing an env file needs docker compose up -d, not restart, to take effect.
keywords: server, logs, docker compose, env file, restart, memory, disk, ssh, deploy user, psql, mail-in
---

Everything runs as the `deploy` user from `/srv/jobtiva`. Become it with `sudo -iu deploy`; the default `ubuntu` user can't open that folder.

| Task | Command |
|---|---|
| What's running | `docker compose ps` |
| Memory and disk | `docker stats --no-stream`, `free -h`, `df -h` |
| App logs | `docker compose logs -f --tail 100 app-prod` (or `app-preprod`, `postgres`) |
| Email receiver logs | `docker compose logs --tail 50 mail-in` |
| Database shell | `docker compose exec postgres psql -U postgres -d jmp_prod` |
| Change a setting in an env file | Edit `env/prod.env`, then `docker compose up -d app-prod` |
| Free memory when not testing | `docker compose stop app-preprod`; start it again with `docker compose up -d app-preprod` |

**Env changes need `up -d`.** `docker compose restart` keeps the old environment, which catches people out. Prod's app answers on port 3000 and preprod's on 3001, behind Nginx.

## Capacity

The server is a small 2 GB machine with 2 GB of swap and a 20 GB disk. If swap stays in use, stop preprod when you're not testing or move up a size. If the disk fills, shorten local backup retention first. Builds happen in GitHub, never on the server.
