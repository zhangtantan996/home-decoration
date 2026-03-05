#!/usr/bin/env bash
set -euo pipefail

# Sync local backup artifacts to Aliyun OSS.
#
# Required env:
#   OSS_BUCKET        e.g. my-prod-bucket
# Optional env:
#   BACKUP_DIR        default: ./backups
#   OSS_PREFIX        default: home-decoration/backups
#   KEEP_LOCAL_DAYS   default: 7 (set 0 to disable cleanup)
#   OSSUTIL_BIN       default: auto-detect ossutil/ossutil64

BACKUP_DIR="${BACKUP_DIR:-./backups}"
OSS_BUCKET="${OSS_BUCKET:-}"
OSS_PREFIX="${OSS_PREFIX:-home-decoration/backups}"
KEEP_LOCAL_DAYS="${KEEP_LOCAL_DAYS:-7}"
OSSUTIL_BIN="${OSSUTIL_BIN:-}"

if [[ -z "${OSS_BUCKET}" ]]; then
  echo "Missing required env var: OSS_BUCKET" >&2
  exit 1
fi

if [[ -n "${OSSUTIL_BIN}" ]]; then
  OSSUTIL="${OSSUTIL_BIN}"
elif command -v ossutil >/dev/null 2>&1; then
  OSSUTIL="ossutil"
elif command -v ossutil64 >/dev/null 2>&1; then
  OSSUTIL="ossutil64"
else
  echo "ossutil not found. Install and configure ossutil first." >&2
  echo "Docs: deploy/OSS_FREE_PLAN_SETUP.md" >&2
  exit 1
fi

if [[ ! -d "${BACKUP_DIR}" ]]; then
  echo "Backup directory not found: ${BACKUP_DIR}" >&2
  exit 1
fi

DEST="oss://${OSS_BUCKET}/${OSS_PREFIX%/}/"

echo "Checking OSS access: ${DEST}"
"${OSSUTIL}" ls "${DEST}" >/dev/null 2>&1 || true

shopt -s nullglob
files=("${BACKUP_DIR}"/*.gz)
shopt -u nullglob

if [[ ${#files[@]} -eq 0 ]]; then
  echo "No .gz backups found in ${BACKUP_DIR}. Nothing to sync."
  exit 0
fi

echo "Uploading ${#files[@]} file(s) to ${DEST}"
for file in "${files[@]}"; do
  echo " -> $(basename "${file}")"
  "${OSSUTIL}" cp "${file}" "${DEST}"
done

if [[ "${KEEP_LOCAL_DAYS}" =~ ^[0-9]+$ ]] && [[ "${KEEP_LOCAL_DAYS}" -gt 0 ]]; then
  echo "Cleaning local .gz backups older than ${KEEP_LOCAL_DAYS} day(s)"
  find "${BACKUP_DIR}" -type f -name "*.gz" -mtime +"${KEEP_LOCAL_DAYS}" -print -delete
fi

echo "OSS sync completed."
