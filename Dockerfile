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
# Use the stable (webpack) build for a reliable standalone bundle.
RUN npx next build

# 3) Minimal runtime image — just the standalone server + static assets.
FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN groupadd -g 1001 nodejs && useradd -u 1001 -g nodejs -m nextjs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
