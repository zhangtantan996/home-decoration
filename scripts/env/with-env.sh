#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/common.sh"

TARGET_ENV="${1:-local}"
shift || true
load_env_contract "$TARGET_ENV"

if [[ "${1:-}" == "--print" || $# -eq 0 ]]; then
  print_effective_env
  exit 0
fi

exec "$@"
