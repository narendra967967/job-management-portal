#!/bin/sh
# → /etc/letsencrypt/mail-in-deploy-hook.sh   (root, chmod 755)
# Certbot deploy hook for the "mail-in" certificate (in.jobtiva.in +
# in.preprod.jobtiva.in). Runs as root after every issue/renewal: copies the
# certificate to /srv/jobtiva/mail-tls, readable by the mail-in container's
# non-root user (uid 1001), and restarts mail-in if it's running so it loads
# the new one. Registered with:  certbot ... --cert-name mail-in --deploy-hook <this file>
set -eu

[ "${RENEWED_LINEAGE:-}" = "/etc/letsencrypt/live/mail-in" ] || exit 0

DEST=/srv/jobtiva/mail-tls
install -d -m 750 -o 1001 -g 1001 "$DEST"
install -m 640 -o 1001 -g 1001 "$RENEWED_LINEAGE/fullchain.pem" "$DEST/fullchain.pem"
install -m 600 -o 1001 -g 1001 "$RENEWED_LINEAGE/privkey.pem" "$DEST/privkey.pem"

cd /srv/jobtiva
if docker compose ps --status running --services 2>/dev/null | grep -qx mail-in; then
  docker compose restart mail-in
fi
