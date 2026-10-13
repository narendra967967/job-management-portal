# Multi-stage build for the Next.js app (standalone output).
# Runs as a small, non-root Node server on EC2. DB/S3/secrets are provided at
# RUNTIME via environment variables (never baked into the image).

# 1) Install all deps (incl. dev — needed to build).
FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# 2) Build. No secrets needed: DATABASE_URL etc. are only read at runtime, and
#    the dashboard routes are dynamic so nothing queries the DB during build.
FROM node:22-bookworm-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Raise V8's heap ceiling — the type-check phase OOMs at the default (~460 MB)
# on a 1 GB build host. Swap covers the overflow.
ENV NODE_OPTIONS=--max-old-space-size=2048
# Better Auth initializes when its module is imported during the build and warns
# when no secret is present. Nothing is signed at build time — the REAL secret is
# provided at runtime via --env-file — so this throwaway placeholder only
# silences the build warning. It lives only in the builder stage; the runner
# image never sets it, so runtime uses the real BETTER_AUTH_SECRET.
ENV BETTER_AUTH_SECRET=build-time-placeholder-not-used-at-runtime
# Use the stable (webpack) build for a reliable standalone bundle.
RUN npx next build

# 3) Minimal runtime image — just the standalone server + static assets.
FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
# /data/uploads is the upload storage mount point. A fresh named volume mounted
# there inherits this ownership, so the non-root app user can write uploads
# (STORAGE_DRIVER=local).
RUN groupadd -g 1001 nodejs && useradd -u 1001 -g nodejs -m nextjs \
 && mkdir -p /data/uploads && chown nextjs:nodejs /data/uploads
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# Deploy-time tooling, run from this same image (no repo or npm ci on the server):
# migrations + their runner, and the one-off résumé mover. The traced standalone
# bundle only has the drizzle-orm files the app uses; the migrator needs the full
# package (same version), so copy it over the traced copy.
COPY --from=builder --chown=nextjs:nodejs /app/db/migrations ./db/migrations
COPY --from=builder --chown=nextjs:nodejs /app/scripts/migrate.mjs /app/scripts/files-db-to-disk.mjs ./scripts/
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/drizzle-orm ./node_modules/drizzle-orm
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
