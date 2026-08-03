#!/usr/bin/env bash
# VPS / no-pnpm Garage bootstrap: website + CORS via Docker.
# Prefer cabin-api image (already on VPS from GHCR) — avoids Docker Hub pulls
# that are slow/unreliable on China VPS. Fallback: node:22-bookworm.
#
# Prerequisites: cabin-garage on cabin-net, .env with ARCHIVE_* / GARAGE_* /
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
CONTAINER="${GARAGE_CONTAINER:-cabin-garage}"
API_IMAGE="${ARCHIVE_BOOTSTRAP_IMAGE:-cabin-api:latest}"
COMPOSE_NET="${ARCHIVE_BOOTSTRAP_NETWORK:-cabin-net}"

if [[ -z "${ARCHIVE_CORS_ORIGINS:-}" ]]; then
  echo "archive:bootstrap-vps: set ARCHIVE_CORS_ORIGINS in .env (e.g. http://YOUR_VPS_IP:8080)" >&2
  exit 1
fi

echo "archive:bootstrap-vps: enabling website on ${CONTAINER} / ${BUCKET}"
docker exec "$CONTAINER" /garage bucket website --allow "$BUCKET"

# CORS must hit Garage on the Docker network. Do NOT use the public
# ARCHIVE_S3_ENDPOINT (VPS_IP:3900) from inside a container — hairpin NAT
# often fails on cloud VPS. Nest still signs with the public endpoint for browsers.
run_cors_with_api_image() {
  echo "archive:bootstrap-vps: CORS via ${API_IMAGE} on ${COMPOSE_NET} → garage:3900"
  docker run --rm \
    --network "$COMPOSE_NET" \
    --env-file "$ROOT/.env" \
    -e ARCHIVE_S3_ENDPOINT=http://garage:3900 \
    -e GARAGE_CONTAINER= \
    -v "$ROOT/deploy/garage/bootstrap.mjs:/bootstrap.mjs:ro" \
    -w /app \
    "$API_IMAGE" \
    node /bootstrap.mjs
}

run_cors_with_node_image() {
  echo "archive:bootstrap-vps: CORS via node:22-bookworm (Hub pull — slow in CN)"
  local npm_reg_args=()
  if [[ -n "${NPM_REGISTRY:-}" ]]; then
    npm_reg_args=(--registry "$NPM_REGISTRY")
    echo "archive:bootstrap-vps: npm using NPM_REGISTRY=${NPM_REGISTRY}"
  fi
  docker run --rm \
    --network host \
    --env-file "$ROOT/.env" \
    -e ARCHIVE_S3_ENDPOINT="${ARCHIVE_S3_ENDPOINT:-http://127.0.0.1:3900}" \
    -e GARAGE_CONTAINER= \
    -v "$ROOT/deploy/garage/bootstrap.mjs:/bootstrap.mjs:ro" \
    -w /tmp \
    node:22-bookworm \
    bash -c "npm i --no-save ${npm_reg_args[*]} @aws-sdk/client-s3@3.1095.0 >/dev/null && node /bootstrap.mjs"
}

if docker image inspect "$API_IMAGE" >/dev/null 2>&1; then
  run_cors_with_api_image
else
  echo "archive:bootstrap-vps: ${API_IMAGE} not found locally — falling back to node:22-bookworm" >&2
  run_cors_with_node_image
fi

echo "archive:bootstrap-vps: done"
