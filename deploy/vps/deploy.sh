#!/usr/bin/env bash
# Deploy one environment on the VPS.
#
#   deploy.sh <prod|preprod> <git-sha> [image.tar.gz]
#
# 1. load the image shipped by CI (if a tarball is given) — no registry involved
# 2. run DB migrations from THAT image, against that env's database
# 3. switch the env's container to the new image (records the old one)
# 4. health-check; on failure, switch back to the previous image and exit 1
# 5. prune old images, keeping the ones in use + the newest few (for rollback)
#
# Rollback by hand:  deploy.sh <env> <older-sha>     (image is still on the host)
set -euo pipefail

ENV="${1:-}"; SHA="${2:-}"; TARBALL="${3:-}"
ROOT=/srv/jobtiva
KEEP=3   # 20 GB disk: in-use images + the newest 3 for rollback

case "$ENV" in
  prod)    VAR=PROD_IMAGE;    PORT=3000 ;;
  preprod) VAR=PREPROD_IMAGE; PORT=3001 ;;
  *) echo "usage: $0 <prod|preprod> <git-sha> [image.tar.gz]" >&2; exit 2 ;;
esac
[ -n "$SHA" ] || { echo "missing git sha" >&2; exit 2; }

cd "$ROOT"
IMAGE="jobtiva:$SHA"
[ -s "env/$ENV.env" ] || { echo "env/$ENV.env is missing or empty — create it first (deploy/VPS.md)." >&2; exit 1; }

get_var() { grep -E "^$1=" .env | cut -d= -f2- || true; }
set_var() {
  if grep -qE "^$1=" .env; then sed -i "s|^$1=.*|$1=$2|" .env; else echo "$1=$2" >> .env; fi
}

if [ -n "$TARBALL" ]; then
  echo "== Load image =="
  gunzip -c "$TARBALL" | docker load
  rm -f "$TARBALL"
fi
docker image inspect "$IMAGE" >/dev/null 2>&1 || { echo "Image $IMAGE is not on this host." >&2; exit 1; }

echo "== Migrations ($ENV) =="
docker run --rm --network jobtiva_default --env-file "env/$ENV.env" "$IMAGE" node scripts/migrate.mjs

PREV="$(get_var "$VAR")"
echo "== Switch $ENV: ${PREV:-none} -> $IMAGE =="
set_var "$VAR" "$IMAGE"
docker compose up -d --no-deps "app-$ENV"

echo "== Health check =="
ok=0
for _ in $(seq 1 30); do
  if curl -fsS -o /dev/null "http://127.0.0.1:$PORT/login"; then ok=1; break; fi
  sleep 2
done

if [ "$ok" -ne 1 ]; then
  echo "!! $ENV failed its health check — rolling back to ${PREV:-none}" >&2
  docker compose logs --tail 60 "app-$ENV" >&2 || true
  if [ -n "$PREV" ] && [ "$PREV" != "jobtiva:none" ]; then
    set_var "$VAR" "$PREV"
    docker compose up -d --no-deps "app-$ENV"
  fi
  exit 1
fi
echo "== $ENV is live on $IMAGE =="

echo "== Prune old images (keep in-use + newest $KEEP) =="
INUSE="$(get_var PROD_IMAGE) $(get_var PREPROD_IMAGE)"
docker images jobtiva --format '{{.CreatedAt}}|{{.Repository}}:{{.Tag}}' \
  | sort -r | cut -d'|' -f2 | tail -n +$((KEEP + 1)) \
  | while read -r img; do
      case " $INUSE " in *" $img "*) continue ;; esac
      docker rmi "$img" >/dev/null 2>&1 && echo "removed $img" || true
    done
docker image prune -f >/dev/null
echo "== Deploy done =="
