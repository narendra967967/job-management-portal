#!/usr/bin/env bash
# Trigger a JMP cron route from the AWS host's scheduler (crontab / systemd timer).
#
#   Usage:   jmp-cron.sh <sync|purge>
#   Needs:   APP_URL       e.g. https://app.example.com  (the app's base URL)
#            CRON_SECRET   must match the server's CRON_SECRET
#
# Both routes are safe to call on a schedule:
#   - sync  gates each user by their own interval AND skips during quiet hours.
#   - purge is a no-op unless Lead retention is enabled in admin Settings.
set -euo pipefail

route="${1:-}"
case "$route" in
  sync)  path="/api/cron/gmail-sync" ;;
  purge) path="/api/cron/purge-leads" ;;
  *) echo "usage: $0 <sync|purge>" >&2; exit 2 ;;
esac

: "${APP_URL:?set APP_URL (e.g. https://app.example.com)}"
: "${CRON_SECRET:?set CRON_SECRET}"

curl -fsS -X POST "${APP_URL}${path}" \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  -o /dev/null -w "[$(date -u +%FT%TZ)] ${route} -> %{http_code}\n"
