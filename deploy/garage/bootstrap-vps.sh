#!/usr/bin/env bash
# VPS / no-pnpm Garage bootstrap: website + CORS via Docker + Node image.
# Run from repo root on the VPS (where .env and deploy/garage/ live).
#
# Prerequisites: cabin-garage (+ :3900 published), .env with ARCHIVE_* / GARAGE_* /
# ARCHIVE_CORS_ORIGINS=http://YOUR_VPS_IP:8080
#
# Usage:
#   chmod +x deploy/garage/bootstrap-vps.sh
#   ./deploy/garage/bootstrap-vps.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

if [[ ! -f .env ]]; then
  echo "archive:bootstrap-vps: missing $ROOT/.env" >&2
  exit 1
fi

# shellcheck disable=SC1091
set -a
# Export vars from .env (skip comments / blank). Prefer simple KEY=VAL lines.
# shellcheck source=/dev/null
source <(grep -E '^[A-Za-z_][A-Za-z0-9_]*=' .env | sed 's/\r$//')
set +a

BUCKET="${ARCHIVE_S3_BUCKET:-${GARAGE_DEFAULT_BUCKET:-cabin-archive}}"
CONTAINER="${GARAGE_CONTAINER:-cabin-garage}"

if [[ -z "${ARCHIVE_CORS_ORIGINS:-}" ]]; then
  echo "archive:bootstrap-vps: set ARCHIVE_CORS_ORIGINS in .env (e.g. http://YOUR_VPS_IP:8080)" >&2
  exit 1
fi

echo "archive:bootstrap-vps: enabling website on ${CONTAINER} / ${BUCKET}"
docker exec "$CONTAINER" /garage bucket website --allow "$BUCKET"

echo "archive:bootstrap-vps: applying CORS via node container (host network → :3900)"
docker run --rm \
  --network host \
  --env-file "$ROOT/.env" \
  -e ARCHIVE_S3_ENDPOINT="${ARCHIVE_S3_ENDPOINT:-http://127.0.0.1:3900}" \
  -e GARAGE_CONTAINER= \
  -v "$ROOT/deploy/garage/bootstrap.mjs:/bootstrap.mjs:ro" \
  -w /tmp \
  node:22-bookworm \
  bash -c 'npm i --no-save @aws-sdk/client-s3@3.1095.0 >/dev/null && node /bootstrap.mjs'

echo "archive:bootstrap-vps: done"
