#!/usr/bin/env bash
set -euo pipefail

# Backup uploads directory persisted on ECS disk.
#
# Default uploads path matches docker-compose.prod.managed.yml:
#   ../server/uploads  (relative to deploy/)
#
# Optional env:
#   UPLOADS_DIR (default: ../server/uploads)
#   BACKUP_DIR  (default: ./backups)

UPLOADS_DIR="${UPLOADS_DIR:-../server/uploads}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"

if [[ ! -d "${UPLOADS_DIR}" ]]; then
  echo "Uploads directory not found: ${UPLOADS_DIR}" >&2
  exit 1
fi

mkdir -p "${BACKUP_DIR}"
TS="$(date -u +%Y%m%dT%H%M%SZ)"
OUT_FILE="${BACKUP_DIR}/uploads_${TS}.tar.gz"

echo "Backing up uploads: ${UPLOADS_DIR} -> ${OUT_FILE}"

tar -czf "${OUT_FILE}" -C "${UPLOADS_DIR}" .

echo "OK: ${OUT_FILE}"
echo ""
echo "Next (optional): upload ${OUT_FILE} to OSS (use ossutil/aliyun-cli configured on the ECS host)."

