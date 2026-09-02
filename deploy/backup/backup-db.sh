#!/usr/bin/env bash
# Daily Postgres backup for Cabin PMS VPS.
# Docs: _docs/database-backup.md
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../lib" && pwd)"
# shellcheck source=../lib/compose.sh
source "${LIB_DIR}/compose.sh"
# shellcheck source=../lib/env.sh
source "${LIB_DIR}/env.sh"

cd "${ROOT_DIR}"

load_root_env

if [ -z "${BACKUP_DIR:-}" ]; then
  if [ "$(id -u)" -eq 0 ]; then
    BACKUP_DIR="/root/backups"
  else
    BACKUP_DIR="${HOME}/backups"
  fi
fi

RETENTION_DAYS="${RETENTION_DAYS:-14}"
BACKUP_TAG="${BACKUP_TAG:-}"
STAMP="$(date +%F)"
if [ -n "${BACKUP_TAG}" ]; then
  OUT_FILE="${BACKUP_DIR}/cabin-${BACKUP_TAG}-${STAMP}.dump"
else
  OUT_FILE="${BACKUP_DIR}/cabin-${STAMP}.dump"
fi
TMP_FILE="${OUT_FILE}.tmp.$$"

mkdir -p "${BACKUP_DIR}"

POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_DB="${POSTGRES_DB:-cabin_pms}"

compose_read_args
compose_ensure

cleanup_tmp() {
  rm -f "${TMP_FILE}"
}
trap cleanup_tmp EXIT

compose exec -T postgres pg_dump \
  -U "${POSTGRES_USER}" \
  -Fc \
  "${POSTGRES_DB}" \
  > "${TMP_FILE}"

mv "${TMP_FILE}" "${OUT_FILE}"
trap - EXIT

find "${BACKUP_DIR}" -name 'cabin-*.dump' -mtime +"${RETENTION_DAYS}" -delete

echo "backup ok: ${OUT_FILE} ($(du -h "${OUT_FILE}" | cut -f1))"

# Optional off-site upload (configure rclone remote first):
# rclone copy "${OUT_FILE}" "remote:cabin-pms-backups/postgres/"
