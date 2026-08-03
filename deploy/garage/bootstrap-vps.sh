#!/usr/bin/env bash
# VPS / no-pnpm Garage bootstrap: website + CORS via the running API container.
#
# GHCR deploy tags images as ghcr.io/<owner>/cabin-api:latest (not cabin-api:latest).
# Resolving via container name cabin-api avoids guessing tags and avoids Docker Hub.
#
# Prerequisites: cabin-garage + cabin-api running on cabin-net, .env with
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
# shellcheck source=/dev/null
source <(grep -E '^[A-Za-z_][A-Za-z0-9_]*=' .env | sed 's/\r$//')
set +a

BUCKET="${ARCHIVE_S3_BUCKET:-${GARAGE_DEFAULT_BUCKET:-cabin-archive}}"
GARAGE_NAME="${GARAGE_CONTAINER:-cabin-garage}"
API_NAME="${ARCHIVE_BOOTSTRAP_API_CONTAINER:-cabin-api}"

if [[ -z "${ARCHIVE_CORS_ORIGINS:-}" ]]; then
  echo "archive:bootstrap-vps: set ARCHIVE_CORS_ORIGINS in .env (e.g. http://YOUR_VPS_IP:8080)" >&2
  exit 1
fi

if ! docker inspect "$GARAGE_NAME" >/dev/null 2>&1; then
  echo "archive:bootstrap-vps: container ${GARAGE_NAME} not running" >&2
  exit 1
fi

if ! docker inspect "$API_NAME" >/dev/null 2>&1; then
  echo "archive:bootstrap-vps: container ${API_NAME} not running" >&2
  echo "  Start the stack first (compose up). Do not pull node: from Docker Hub on China VPS." >&2
  exit 1
fi

echo "archive:bootstrap-vps: enabling website on ${GARAGE_NAME} / ${BUCKET}"
docker exec "$GARAGE_NAME" /garage bucket website --allow "$BUCKET"

# CORS from inside cabin-api → garage:3900 on cabin-net.
# Do NOT use public VPS_IP:3900 here (hairpin NAT often fails).
# Nest still signs browser PUTs with public ARCHIVE_S3_ENDPOINT from .env.
SCRIPT_HOST="$ROOT/deploy/garage/bootstrap.mjs"
SCRIPT_CTR=/tmp/archive-bootstrap.mjs

echo "archive:bootstrap-vps: CORS via docker exec ${API_NAME} → garage:3900"
docker cp "$SCRIPT_HOST" "${API_NAME}:${SCRIPT_CTR}"
docker exec \
  -e ARCHIVE_S3_ENDPOINT=http://garage:3900 \
  -e GARAGE_CONTAINER= \
  -w /app \
  "$API_NAME" \
  node "$SCRIPT_CTR"
docker exec "$API_NAME" rm -f "$SCRIPT_CTR" >/dev/null 2>&1 || true

echo "archive:bootstrap-vps: done"
