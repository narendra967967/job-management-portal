#!/usr/bin/env bash
# Nightly backup: both databases + both upload volumes.
#   local:  /srv/jobtiva/backups/<stamp>/   (kept 14 days)
#   remote: rclone remote "gdrive:jobtiva-backups/<stamp>/"   (kept 30 days)
# Skips the off-site copy (with a warning) if the rclone "gdrive" remote isn't set up.
set -euo pipefail

ROOT=/srv/jobtiva
DEST="$ROOT/backups"
STAMP="$(date -u +%Y-%m-%d_%H%M)"
OUT="$DEST/$STAMP"
REMOTE="gdrive:jobtiva-backups"
umask 077
mkdir -p "$OUT"
cd "$ROOT"

echo "[$(date -u +%FT%TZ)] backup $STAMP"
for db in jmp_prod jmp_preprod; do
  docker compose exec -T postgres pg_dump -U postgres -Fc "$db" > "$OUT/$db.dump"
  echo "  db $db: $(du -h "$OUT/$db.dump" | cut -f1)"
done
for env in prod preprod; do
  docker run --rm -v "jobtiva_uploads-$env:/data:ro" alpine tar czf - -C /data . > "$OUT/uploads-$env.tar.gz"
  echo "  uploads $env: $(du -h "$OUT/uploads-$env.tar.gz" | cut -f1)"
done

# Local retention.
find "$DEST" -mindepth 1 -maxdepth 1 -type d -mtime +14 -exec rm -rf {} +

# Off-site copy.
if command -v rclone >/dev/null 2>&1 && rclone listremotes | grep -qx 'gdrive:'; then
  rclone copy "$OUT" "$REMOTE/$STAMP"
  rclone delete --min-age 30d "$REMOTE" || true
  rclone rmdirs --leave-root "$REMOTE" || true
  echo "  off-site: copied to $REMOTE/$STAMP"
else
  echo "  WARNING: rclone remote 'gdrive' not configured — off-site copy skipped" >&2
fi
echo "[$(date -u +%FT%TZ)] backup done"
