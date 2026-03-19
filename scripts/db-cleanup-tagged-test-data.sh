#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

# shellcheck source=/dev/null
source "${ROOT_DIR}/scripts/env/common.sh"

TARGET_ENV="${1:-local}"
shift || true

load_env_contract "${TARGET_ENV}"

echo "[testdata-cleaner] APP_ENV=${APP_ENV}"
echo "[testdata-cleaner] DATABASE_HOST=${DATABASE_HOST:-}"
echo "[testdata-cleaner] DATABASE_DBNAME=${DATABASE_DBNAME:-${DATABASE_NAME:-}}"
echo

cd "${ROOT_DIR}/server"
go run ./cmd/testdata-cleaner "$@"
