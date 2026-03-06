#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/common.sh"

TARGET_ENV="${1:-local}"
PLATFORM="${2:-android}"
shift 2 || true

load_env_contract "$TARGET_ENV"

TMP_ENVFILE="$(mktemp "/tmp/home-decoration-mobile.${APP_ENV}.XXXXXX.env")"
write_mobile_env_file "$TMP_ENVFILE"

cd "${ROOT_DIR}/mobile"
case "$PLATFORM" in
  android)
    exec env ENVFILE="$TMP_ENVFILE" npm run android "$@"
    ;;
  ios)
    exec env ENVFILE="$TMP_ENVFILE" npm run ios "$@"
    ;;
  *)
    echo "Unsupported mobile platform: $PLATFORM" >&2
    exit 1
    ;;
 esac
