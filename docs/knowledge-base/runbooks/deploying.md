---
title: How a deploy works, and rolling one back
category: Runbooks
summary: Pushing to preprod deploys preprod. Pushing to prod deploys prod after an approval click. Each deploy builds the image in GitHub, runs its migrations, switches the container and rolls back by itself if the health check fails.
keywords: deploy, release, preprod, prod, migrations, rollback, roll back, github actions, ci, promote
---

Both environments run on one server, as separate containers with separate databases. Work happens on `narendra`; the owner merges and pushes.

| Push to | Workflow | Deploys |
|---|---|---|
| `preprod` | Deploy preprod | Preprod, right away |
| `prod` | Deploy prod | Prod, after the owner approves it in GitHub |

## What a deploy does

1. GitHub builds the image on an ARM runner, matching the server, unless that exact commit's image is already there.
2. The image is shipped to the server and `deploy.sh` runs.
3. **Database migrations run from the new image**, against that environment's database. A deploy with new migrations needs nothing extra.
4. The container switches to the new image.
5. It checks `/login` responds. If not, it switches back to the previous image and the deploy fails.
6. The newest 3 images are kept for rollback.

On start, the app also syncs the admin knowledge base from `docs/knowledge-base`.

## Promote, don't rebuild

To release what preprod tested, fast-forward `prod` to it with `git merge --ff-only preprod`. The commit is the same, so the exact image that ran on preprod goes live without being rebuilt.

## Rolling back

As the deploy user in `/srv/jobtiva`, run `./deploy.sh prod <older-sha>`. `docker images jobtiva` lists the images still on the server. A rollback doesn't undo migrations, so a migration that changed data needs its own fix.
