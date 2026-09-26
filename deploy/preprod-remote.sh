#!/usr/bin/env bash
# Runs ON the preprod EC2 (invoked by the GitHub Actions deploy via SSM).
# Assumes the repo has already been fetched/reset to origin/preprod by the caller.
# Applies migrations (from inside the VPC — RDS is private), then pulls the
# CI-built image from ECR and restarts the container using the box's .env.
set -euo pipefail

REGION=ap-south-1
REGISTRY=504721334099.dkr.ecr.ap-south-1.amazonaws.com
IMAGE="$REGISTRY/jmp-app:preprod-latest"
APP_DIR=/home/ubuntu/job-management-portal

echo "== ECR login =="
aws ecr get-login-password --region "$REGION" | docker login --username AWS --password-stdin "$REGISTRY"

echo "== DB migrations =="
docker run --rm --env-file "$APP_DIR/.env" -v "$APP_DIR:/app" -w /app \
  node:22-bookworm-slim bash -lc "npm ci --no-audit --no-fund && npm run db:migrate"

echo "== Pull image =="
docker pull "$IMAGE"

echo "== Restart app =="
docker rm -f jmp || true
docker run -d --name jmp --env-file "$APP_DIR/.env" \
  -p 127.0.0.1:3000:3000 --restart unless-stopped "$IMAGE"

docker image prune -f
echo "== Deploy done =="
