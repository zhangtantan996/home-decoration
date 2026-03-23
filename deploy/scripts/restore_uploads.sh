#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: bash deploy/scripts/restore_uploads.sh <uploads.tar.gz> [target_dir]" >&2
  exit 1
fi

ARCHIVE_FILE="$1"
TARGET_DIR="${2:-./restore-output/uploads_$(date -u +%Y%m%dT%H%M%SZ)}"

if [[ ! -f "${ARCHIVE_FILE}" ]]; then
  echo "Archive file not found: ${ARCHIVE_FILE}" >&2
  exit 1
fi

mkdir -p "${TARGET_DIR}"

echo "Restoring uploads archive: ${ARCHIVE_FILE}"
echo "Target directory: ${TARGET_DIR}"

tar -xzf "${ARCHIVE_FILE}" -C "${TARGET_DIR}"

echo "Uploads restore completed."
