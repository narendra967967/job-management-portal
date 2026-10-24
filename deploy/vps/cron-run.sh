#!/usr/bin/env bash
# Crontab helper: call a cron route for one environment on this host.
#   cron-run.sh <prod|preprod> <sync|purge|ai>
# Reads that env's CRON_SECRET from /srv/jobtiva/env/<env>.env and calls the app
# directly on localhost (no DNS / Nginx / TLS in the path).
set -euo pipefail

ENV="${1:-}"; ROUTE="${2:-}"
ROOT=/srv/jobtiva
case "$ENV" in
  prod)    PORT=3000 ;;
  preprod) PORT=3001 ;;
  *) echo "usage: $0 <prod|preprod> <sync|purge|ai>" >&2; exit 2 ;;
esac

SECRET="$(grep -E '^CRON_SECRET=' "$ROOT/env/$ENV.env" | cut -d= -f2-)"
[ -n "$SECRET" ] || { echo "CRON_SECRET missing in env/$ENV.env" >&2; exit 1; }

APP_URL="http://127.0.0.1:$PORT" CRON_SECRET="$SECRET" exec "$ROOT/jmp-cron.sh" "$ROUTE"
