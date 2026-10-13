#!/usr/bin/env bash
# Runs on the GitHub Actions runner (not on the VPS).
#   deploy/vps/ci-ship.sh <prod|preprod>
#
# 1. sync the deploy kit (this folder + jmp-cron.sh) to /srv/jobtiva
# 2. if jobtiva:<sha> is already on the VPS (e.g. prod promoting what preprod
#    tested), deploy it as-is; otherwise build here and ship it over SSH
#    (docker save | gzip — no container registry)
# 3. run deploy.sh on the VPS (migrate → switch → health check → auto-rollback)
#
# Needs: an ssh host alias "vps" (the workflow writes it) and GITHUB_SHA.
set -euo pipefail

ENV="${1:-}"
case "$ENV" in prod|preprod) ;; *) echo "usage: $0 <prod|preprod>" >&2; exit 2 ;; esac
SHA="${GITHUB_SHA:?GITHUB_SHA not set}"
IMAGE="jobtiva:$SHA"
REMOTE=/srv/jobtiva

echo "== Sync deploy kit =="
stage="$(mktemp -d)"
cp -r deploy/vps/. "$stage/"
cp scripts/cron/jmp-cron.sh "$stage/"
rm -f "$stage/ci-ship.sh"
( cd "$stage" && tar -czf - * ) | ssh vps "tar -xzf - -C $REMOTE && chmod +x $REMOTE/*.sh && mkdir -p $REMOTE/logs $REMOTE/incoming"

if ssh vps "docker image inspect $IMAGE >/dev/null 2>&1"; then
  echo "== $IMAGE is already on the VPS — deploying it as-is =="
  ssh vps "$REMOTE/deploy.sh $ENV $SHA"
else
  echo "== Build $IMAGE =="
  docker build -t "$IMAGE" .
  echo "== Ship image =="
  docker save "$IMAGE" | gzip -1 | ssh vps "cat > $REMOTE/incoming/$SHA.tar.gz"
  ssh vps "$REMOTE/deploy.sh $ENV $SHA $REMOTE/incoming/$SHA.tar.gz"
fi
