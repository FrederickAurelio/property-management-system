#!/usr/bin/env bash
# Daily Postgres backup for Cabin PMS VPS.
# Docs: _docs/database-backup.md
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-/root/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
STAMP="$(date +%F)"
OUT_FILE="${BACKUP_DIR}/cabin-${STAMP}.dump"

mkdir -p "${BACKUP_DIR}"
cd "${ROOT_DIR}"

# shellcheck disable=SC1091
set -a
[ -f .env ] && . ./.env
set +a

POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_DB="${POSTGRES_DB:-cabin_pms}"

docker compose exec -T postgres pg_dump \
  -U "${POSTGRES_USER}" \
  -Fc \
  "${POSTGRES_DB}" \
  > "${OUT_FILE}"

find "${BACKUP_DIR}" -name 'cabin-*.dump' -mtime +"${RETENTION_DAYS}" -delete

echo "backup ok: ${OUT_FILE} ($(du -h "${OUT_FILE}" | cut -f1))"

# Optional off-site upload (configure rclone remote first):
# rclone copy "${OUT_FILE}" "remote:cabin-pms-backups/postgres/"
