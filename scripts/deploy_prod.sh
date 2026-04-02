#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
TARGET_SCRIPT="${REPO_ROOT}/deploy/scripts/deploy_prod.sh"

if [[ ! -f "${TARGET_SCRIPT}" ]]; then
  echo "Missing canonical production deploy script: ${TARGET_SCRIPT}" >&2
  exit 1
fi

echo "[deprecated] 根目录 scripts/deploy_prod.sh 仅保留兼容转发，请改用: bash deploy/scripts/deploy_prod.sh ..."
exec bash "${TARGET_SCRIPT}" "$@"
