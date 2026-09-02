#!/usr/bin/env bash
# Run prisma migrate deploy on the VPS. Backs up Postgres first when migrations are pending.
# Docs: _docs/database-backup.md
#
# Usage (from repo root on VPS):
#   bash deploy/vps-migrate-deploy.sh
#   COMPOSE_FILE_ARGS="-f docker-compose.yml -f docker-compose.ci.yml" bash deploy/vps-migrate-deploy.sh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LIB_DIR="${ROOT_DIR}/deploy/lib"
# shellcheck source=lib/compose.sh
source "${LIB_DIR}/compose.sh"

cd "${ROOT_DIR}"

compose_read_args
compose_ensure

echo "=== prisma migrate status ==="
STATUS_OUTPUT=""
STATUS_EXIT=0
STATUS_OUTPUT="$(compose exec -T api npx prisma migrate status 2>&1)" || STATUS_EXIT=$?

if [ "${STATUS_EXIT}" -eq 0 ]; then
  echo "${STATUS_OUTPUT}"
  echo "=== no pending migrations; skipping pre-migrate backup ==="
else
  echo "${STATUS_OUTPUT}"

  # Prisma 6 prints variants such as:
  # - "Following migration have not yet been applied:"
  # - "Following migrations have not yet been applied:"
  # - "The migration have not yet been applied:"
  if echo "${STATUS_OUTPUT}" | grep -qi 'not yet been applied'; then
    echo "=== pending migrations; running pre-migrate backup ==="
    COMPOSE_FILE_ARGS="${COMPOSE_FILE_ARGS:-}" BACKUP_TAG=pre-migrate \
      bash "${ROOT_DIR}/deploy/backup/backup-db.sh"
  elif echo "${STATUS_OUTPUT}" | grep -qiE 'following migration.*have failed|failed migration'; then
    echo "vps-migrate-deploy: failed migration(s) in database — fix manually before deploy" >&2
    exit 1
  else
    echo "vps-migrate-deploy: unexpected prisma migrate status failure" >&2
    exit 1
  fi
fi

echo "=== prisma migrate deploy ==="
compose exec -T api npx prisma migrate deploy
